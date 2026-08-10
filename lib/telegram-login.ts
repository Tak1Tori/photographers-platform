import { createHash, randomBytes } from "node:crypto";
import { LegalDocumentType, Prisma, UserRole, type User } from "@prisma/client";
import { canUseDatabase } from "@/lib/data/db";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

const TELEGRAM_PROVIDER = "telegram";
const INTENT_TTL_MS = 10 * 60 * 1000;
const SESSION_TICKET_TTL_MS = 5 * 60 * 1000;
const ONE_TIME_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

type TelegramOidcProfile = {
  sub?: unknown;
  name?: unknown;
  preferred_username?: unknown;
  picture?: unknown;
  phone_number?: unknown;
  phone_number_verified?: unknown;
};

type AuthUser = Pick<User, "id" | "name" | "email" | "image" | "phone" | "role">;

type TelegramIdentity = {
  subject: string;
  name: string;
  username: string | null;
  image: string | null;
  phone: string;
};

export type TelegramSignInResult =
  | { status: "signed-in" }
  | { status: "onboarding"; intentToken: string }
  | { status: "password-verification-required"; intentToken: string }
  | { status: "phone-required" }
  | { status: "phone-already-linked" }
  | { status: "failed" };

export type TelegramOnboardingIntent = {
  displayName: string;
  phone: string;
};

export type TelegramOnboardingResult =
  | { success: true; ticket: string; redirectTo: string }
  | { success: false; error: string };

export function isTelegramLoginEnabled() {
  return Boolean(process.env.TELEGRAM_OIDC_CLIENT_ID && process.env.TELEGRAM_OIDC_CLIENT_SECRET);
}

export async function handleTelegramOidcSignIn(
  profile: TelegramOidcProfile,
  currentUserId?: string
): Promise<TelegramSignInResult> {
  if (!canUseDatabase()) return { status: "failed" };

  const identity = parseTelegramIdentity(profile);
  if (!identity) return { status: "phone-required" };

  const linkedAccount = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: TELEGRAM_PROVIDER,
        providerAccountId: identity.subject
      }
    },
    select: { userId: true }
  });

  if (linkedAccount) return { status: "signed-in" };

  const phoneOwner = await prisma.user.findUnique({
    where: { phone: identity.phone },
    select: { id: true, phoneVerifiedAt: true }
  });

  if (phoneOwner) {
    const ownerTelegramAccount = await prisma.account.findFirst({
      where: { userId: phoneOwner.id, provider: TELEGRAM_PROVIDER },
      select: { providerAccountId: true }
    });

    if (ownerTelegramAccount && ownerTelegramAccount.providerAccountId !== identity.subject) {
      return { status: "phone-already-linked" };
    }

    // Password-based accounts created before Telegram OIDC have unverified
    // phones. A phone claim from Telegram alone must not grant their access.
    if (!phoneOwner.phoneVerifiedAt && phoneOwner.id !== currentUserId) {
      return createPendingAccountLinkIntent(identity, phoneOwner.id);
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.account.create({
          data: {
            userId: phoneOwner.id,
            type: "oauth",
            provider: TELEGRAM_PROVIDER,
            providerAccountId: identity.subject,
            scope: "openid profile phone"
          }
        });

        if (!phoneOwner.phoneVerifiedAt) {
          await tx.user.update({
            where: { id: phoneOwner.id },
            data: { phoneVerifiedAt: new Date() }
          });
        }
      });

      return { status: "signed-in" };
    } catch (error) {
      if (!isUniqueConstraintError(error)) return { status: "failed" };

      const accountAfterRace = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: TELEGRAM_PROVIDER,
            providerAccountId: identity.subject
          }
        },
        select: { userId: true }
      });

      return accountAfterRace?.userId === phoneOwner.id
        ? { status: "signed-in" }
        : { status: "phone-already-linked" };
    }
  }

  const intentToken = createOneTimeToken();
  await prisma.telegramLoginIntent.create({
    data: {
      tokenHash: hashToken(intentToken),
      telegramSubject: identity.subject,
      displayName: identity.name,
      username: identity.username,
      image: identity.image,
      phone: identity.phone,
      phoneVerifiedAt: new Date(),
      expiresAt: new Date(Date.now() + INTENT_TTL_MS)
    }
  });

  return { status: "onboarding", intentToken };
}

async function createPendingAccountLinkIntent(
  identity: TelegramIdentity,
  userId: string
): Promise<TelegramSignInResult> {
  const intentToken = createOneTimeToken();

  await prisma.telegramLoginIntent.create({
    data: {
      tokenHash: hashToken(intentToken),
      telegramSubject: identity.subject,
      displayName: identity.name,
      username: identity.username,
      image: identity.image,
      phone: identity.phone,
      phoneVerifiedAt: new Date(),
      pendingLinkUserId: userId,
      expiresAt: new Date(Date.now() + INTENT_TTL_MS)
    }
  });

  return { status: "password-verification-required", intentToken };
}

export async function getTelegramAccountUser(telegramSubject: string): Promise<AuthUser | null> {
  if (!canUseDatabase() || !telegramSubject) return null;

  const account = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: TELEGRAM_PROVIDER,
        providerAccountId: telegramSubject
      }
    },
    select: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          phone: true,
          role: true
        }
      }
    }
  });

  return account?.user ?? null;
}

export async function getTelegramOnboardingIntent(token: string): Promise<TelegramOnboardingIntent | null> {
  if (!canUseDatabase() || !isOneTimeToken(token)) return null;

  return prisma.telegramLoginIntent.findFirst({
    where: {
      tokenHash: hashToken(token),
      completedAt: null,
      pendingLinkUserId: null,
      expiresAt: { gt: new Date() }
    },
    select: {
      displayName: true,
      phone: true
    }
  });
}

export async function getPendingTelegramAccountLinkIntent(
  token: string,
  userId: string
): Promise<TelegramOnboardingIntent | null> {
  if (!canUseDatabase() || !isOneTimeToken(token) || !userId) return null;

  return prisma.telegramLoginIntent.findFirst({
    where: {
      tokenHash: hashToken(token),
      pendingLinkUserId: userId,
      completedAt: null,
      expiresAt: { gt: new Date() }
    },
    select: {
      displayName: true,
      phone: true
    }
  });
}

export async function completeTelegramAccountLink(
  token: string,
  userId: string
): Promise<{ success: true } | { success: false; error: string }> {
  if (!canUseDatabase() || !isOneTimeToken(token) || !userId) {
    return { success: false, error: "Ссылка для привязки Telegram недействительна или истекла." };
  }

  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      const intent = await tx.telegramLoginIntent.findFirst({
        where: {
          tokenHash: hashToken(token),
          pendingLinkUserId: userId,
          completedAt: null,
          expiresAt: { gt: now }
        }
      });

      if (!intent) {
        throw new TelegramOnboardingError("Ссылка для привязки Telegram недействительна или истекла.");
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, phone: true }
      });

      if (!user || user.phone !== intent.phone) {
        throw new TelegramOnboardingError("Номер аккаунта изменился. Начните привязку Telegram заново.");
      }

      const existingAccount = await tx.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: TELEGRAM_PROVIDER,
            providerAccountId: intent.telegramSubject
          }
        },
        select: { userId: true }
      });

      if (existingAccount && existingAccount.userId !== userId) {
        throw new TelegramOnboardingError("Этот Telegram-аккаунт уже связан с другим профилем.");
      }

      if (!existingAccount) {
        await tx.account.create({
          data: {
            userId,
            type: "oauth",
            provider: TELEGRAM_PROVIDER,
            providerAccountId: intent.telegramSubject,
            scope: "openid profile phone"
          }
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: { phoneVerifiedAt: intent.phoneVerifiedAt }
      });

      const completed = await tx.telegramLoginIntent.updateMany({
        where: {
          id: intent.id,
          pendingLinkUserId: userId,
          completedAt: null,
          expiresAt: { gt: now }
        },
        data: {
          completedAt: now,
          userId,
          pendingLinkUserId: null
        }
      });

      if (completed.count !== 1) {
        throw new TelegramOnboardingError("Ссылка для привязки Telegram уже использована.");
      }
    });

    return { success: true };
  } catch (error) {
    if (error instanceof TelegramOnboardingError) {
      return { success: false, error: error.message };
    }

    if (isUniqueConstraintError(error)) {
      return { success: false, error: "Telegram уже был привязан в другом окне. Обновите страницу." };
    }

    return { success: false, error: "Не удалось привязать Telegram. Попробуйте еще раз." };
  }
}

export async function completeTelegramOnboarding(
  token: string,
  role: "CLIENT" | "PHOTOGRAPHER",
  acceptedLegal: boolean
): Promise<TelegramOnboardingResult> {
  if (!canUseDatabase() || !isOneTimeToken(token)) {
    return { success: false, error: "Ссылка для входа недействительна или истекла." };
  }

  if (!acceptedLegal) {
    return { success: false, error: "Подтвердите согласие с условиями Framely." };
  }

  const sessionTicket = createOneTimeToken();
  const now = new Date();

  try {
    const user = await prisma.$transaction(async (tx) => {
      const intent = await tx.telegramLoginIntent.findFirst({
        where: {
          tokenHash: hashToken(token),
          completedAt: null,
          pendingLinkUserId: null,
          expiresAt: { gt: now }
        }
      });

      if (!intent) {
        throw new TelegramOnboardingError("Ссылка для входа недействительна или истекла.");
      }

      let user = await tx.account
        .findUnique({
          where: {
            provider_providerAccountId: {
              provider: TELEGRAM_PROVIDER,
              providerAccountId: intent.telegramSubject
            }
          },
          select: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                phone: true,
                role: true
              }
            }
          }
        })
        .then((account) => account?.user ?? null);

      let isNewUser = false;
      if (!user) {
        const phoneOwner = await tx.user.findUnique({
          where: { phone: intent.phone },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            phone: true,
            role: true,
            phoneVerifiedAt: true
          }
        });

        if (phoneOwner) {
          const linkedTelegramAccount = await tx.account.findFirst({
            where: { userId: phoneOwner.id, provider: TELEGRAM_PROVIDER },
            select: { providerAccountId: true }
          });

          if (linkedTelegramAccount && linkedTelegramAccount.providerAccountId !== intent.telegramSubject) {
            throw new TelegramOnboardingError("Этот номер уже связан с другим Telegram-аккаунтом.");
          }

          if (!phoneOwner.phoneVerifiedAt) {
            throw new TelegramOnboardingError(
              "Для привязки Telegram войдите в существующий аккаунт по паролю."
            );
          }

          user = phoneOwner;
        } else {
          user = await tx.user.create({
            data: {
              name: intent.displayName,
              phone: intent.phone,
              phoneVerifiedAt: intent.phoneVerifiedAt,
              image: intent.image,
              role: role as UserRole
            },
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              phone: true,
              role: true
            }
          });
          isNewUser = true;
        }

        const account = await tx.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: TELEGRAM_PROVIDER,
              providerAccountId: intent.telegramSubject
            }
          },
          update: {},
          create: {
            userId: user.id,
            type: "oauth",
            provider: TELEGRAM_PROVIDER,
            providerAccountId: intent.telegramSubject,
            scope: "openid profile phone"
          }
        });

        if (account.userId !== user.id) {
          throw new TelegramOnboardingError("Этот Telegram-аккаунт уже связан с другим профилем.");
        }
      }

      if (isNewUser && user.role === UserRole.PHOTOGRAPHER) {
        await tx.photographerProfile.create({
          data: {
            userId: user.id,
            name: user.name,
            city: "Алматы",
            bio: "Заполните описание профиля.",
            avatarUrl:
              "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80",
            hourlyRate: 0,
            rating: 0,
            status: "DRAFT"
          }
        });
      }

      if (isNewUser) {
        await tx.legalAcceptance.createMany({
          data: [
            {
              userId: user.id,
              documentType: LegalDocumentType.TERMS,
              documentVersion: "2026-08-05",
              source: "telegram-registration"
            },
            {
              userId: user.id,
              documentType: LegalDocumentType.PRIVACY,
              documentVersion: "2026-08-03",
              source: "telegram-registration"
            }
          ],
          skipDuplicates: true
        });
      }

      const completed = await tx.telegramLoginIntent.updateMany({
        where: {
          id: intent.id,
          tokenHash: hashToken(token),
          completedAt: null,
          expiresAt: { gt: now }
        },
        data: {
          completedAt: now,
          userId: user.id,
          sessionTokenHash: hashToken(sessionTicket),
          sessionTokenExpiresAt: new Date(Date.now() + SESSION_TICKET_TTL_MS)
        }
      });

      if (completed.count !== 1) {
        throw new TelegramOnboardingError("Ссылка для входа уже использована.");
      }

      return user;
    });

    return {
      success: true,
      ticket: sessionTicket,
      redirectTo: user.role === UserRole.PHOTOGRAPHER ? "/dashboard/photographer" : "/dashboard/client"
    };
  } catch (error) {
    if (error instanceof TelegramOnboardingError) {
      return { success: false, error: error.message };
    }

    if (isUniqueConstraintError(error)) {
      return { success: false, error: "Не удалось завершить вход. Попробуйте войти через Telegram еще раз." };
    }

    return { success: false, error: "Не удалось завершить вход. Попробуйте еще раз." };
  }
}

export async function consumeTelegramSessionTicket(ticket: string): Promise<AuthUser | null> {
  if (!canUseDatabase() || !isOneTimeToken(ticket)) return null;

  const ticketHash = hashToken(ticket);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const intent = await tx.telegramLoginIntent.findFirst({
      where: {
        sessionTokenHash: ticketHash,
        sessionTokenUsedAt: null,
        sessionTokenExpiresAt: { gt: now },
        userId: { not: null }
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            phone: true,
            role: true
          }
        }
      }
    });

    if (!intent?.user) return null;

    const consumed = await tx.telegramLoginIntent.updateMany({
      where: {
        id: intent.id,
        sessionTokenHash: ticketHash,
        sessionTokenUsedAt: null,
        sessionTokenExpiresAt: { gt: now }
      },
      data: { sessionTokenUsedAt: now }
    });

    return consumed.count === 1 ? intent.user : null;
  });
}

function parseTelegramIdentity(profile: TelegramOidcProfile): TelegramIdentity | null {
  const subject = toNonEmptyString(profile.sub);
  const phone = normalizePhone(toNonEmptyString(profile.phone_number));

  if (!subject || !phone || profile.phone_number_verified !== true) return null;

  return {
    subject,
    name: normalizeDisplayName(profile.name, profile.preferred_username),
    username: normalizeUsername(profile.preferred_username),
    image: normalizeImage(profile.picture),
    phone
  };
}

function normalizeDisplayName(name: unknown, username: unknown) {
  const normalizedName = toNonEmptyString(name)?.replace(/\s+/g, " ").slice(0, 160);
  const normalizedUsername = normalizeUsername(username);
  return normalizedName || normalizedUsername || "Пользователь Telegram";
}

function normalizeUsername(value: unknown) {
  const username = toNonEmptyString(value)?.replace(/^@/, "").slice(0, 64);
  return username || null;
}

function normalizeImage(value: unknown) {
  const image = toNonEmptyString(value);
  if (!image || image.length > 2048) return null;

  try {
    const url = new URL(image);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function toNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function createOneTimeToken() {
  return randomBytes(32).toString("base64url");
}

function isOneTimeToken(value: string) {
  return ONE_TIME_TOKEN_PATTERN.test(value);
}

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

class TelegramOnboardingError extends Error {}
