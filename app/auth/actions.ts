"use server";

import { hash } from "bcryptjs";
import { LegalDocumentType, Prisma, UserRole } from "@prisma/client";
import { getDashboardHref } from "@/lib/auth";
import { canUseDatabase } from "@/lib/data/db";
import { privacyLegalDocument, legalDocuments } from "@/lib/legal-documents";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import {
  checkTelegramGatewayVerification,
  sendTelegramGatewayVerification
} from "@/lib/telegram-gateway";

const pendingRegistrationTtlMs = 15 * 60 * 1000;
const resendCooldownMs = 60 * 1000;
const maxVerificationAttempts = 5;

type RegistrationRole = "CLIENT" | "PHOTOGRAPHER" | "EDITOR";

interface StartRegistrationInput {
  name: string;
  phone: string;
  password: string;
  role: RegistrationRole;
  acceptedLegal: boolean;
}

interface VerificationInput {
  pendingRegistrationId: string;
  code: string;
}

function getLegalVersions() {
  return {
    terms: legalDocuments.terms.version,
    privacy: privacyLegalDocument.version
  };
}

function registrationRedirect(role: RegistrationRole) {
  return getDashboardHref(role);
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isRetryablePendingRegistrationError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export async function startRegistrationAction(input: StartRegistrationInput) {
  if (!canUseDatabase()) {
    return { success: false, error: "DATABASE_URL is not configured" } as const;
  }

  const name = input.name.trim();
  const phone = normalizePhone(input.phone);
  const role = input.role;

  if (!name) {
    return { success: false, error: "Укажите имя" } as const;
  }

  if (!phone) {
    return { success: false, error: "Укажите корректный номер телефона" } as const;
  }

  if (input.password.length < 8) {
    return { success: false, error: "Пароль должен содержать не менее 8 символов" } as const;
  }

  if (!(["CLIENT", "PHOTOGRAPHER", "EDITOR"] as const).includes(role)) {
    return { success: false, error: "Некорректная роль" } as const;
  }

  if (!input.acceptedLegal) {
    return { success: false, error: "Подтвердите согласие с условиями Framely." } as const;
  }

  const existingUser = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if (existingUser) {
    return { success: false, error: "Этот номер телефона уже зарегистрирован" } as const;
  }

  const now = new Date();
  const existingPending = await prisma.pendingRegistration.findUnique({ where: { phone } });
  if (existingPending && existingPending.expiresAt > now && existingPending.telegramGatewayRequestId) {
    const updatedPending = await prisma.pendingRegistration.update({
      where: { id: existingPending.id },
      data: {
        name,
        passwordHash: await hash(input.password, 12),
        role: role as UserRole,
        acceptedTermsVersion: getLegalVersions().terms,
        acceptedPrivacyVersion: getLegalVersions().privacy
      }
    });

    return {
      success: true,
      pendingRegistrationId: updatedPending.id,
      resendAvailableAt: updatedPending.resendAvailableAt.toISOString()
    } as const;
  }

  const passwordHash = await hash(input.password, 12);
  const { terms, privacy } = getLegalVersions();
  const expiresAt = new Date(now.getTime() + pendingRegistrationTtlMs);

  const pending = await prisma.pendingRegistration.upsert({
    where: { phone },
    create: {
      name,
      phone,
      passwordHash,
      role: role as UserRole,
      acceptedTermsVersion: terms,
      acceptedPrivacyVersion: privacy,
      expiresAt,
      resendAvailableAt: new Date(now.getTime() + resendCooldownMs)
    },
    update: {
      name,
      passwordHash,
      role: role as UserRole,
      acceptedTermsVersion: terms,
      acceptedPrivacyVersion: privacy,
      telegramGatewayRequestId: null,
      expiresAt,
      attempts: 0,
      resendAvailableAt: new Date(now.getTime() + resendCooldownMs)
    }
  });

  try {
    const { requestId } = await sendTelegramGatewayVerification(phone);
    const updatedPending = await prisma.pendingRegistration.update({
      where: { id: pending.id },
      data: { telegramGatewayRequestId: requestId }
    });

    return {
      success: true,
      pendingRegistrationId: updatedPending.id,
      resendAvailableAt: updatedPending.resendAvailableAt.toISOString()
    } as const;
  } catch {
    await prisma.pendingRegistration.deleteMany({
      where: { id: pending.id, telegramGatewayRequestId: null }
    });
    return {
      success: false,
      error: "Не удалось отправить код через Telegram. Проверьте номер и попробуйте снова."
    } as const;
  }
}

export async function resendRegistrationCodeAction(pendingRegistrationId: string) {
  if (!canUseDatabase()) {
    return { success: false, error: "DATABASE_URL is not configured" } as const;
  }

  const pending = await prisma.pendingRegistration.findUnique({ where: { id: pendingRegistrationId } });
  const now = new Date();

  if (!pending || pending.expiresAt <= now) {
    return { success: false, error: "Время подтверждения истекло. Начните регистрацию заново." } as const;
  }

  if (pending.resendAvailableAt > now) {
    return {
      success: false,
      error: "Повторная отправка пока недоступна",
      resendAvailableAt: pending.resendAvailableAt.toISOString()
    } as const;
  }

  try {
    const { requestId } = await sendTelegramGatewayVerification(pending.phone);
    const updatedPending = await prisma.pendingRegistration.update({
      where: { id: pending.id },
      data: {
        telegramGatewayRequestId: requestId,
        attempts: 0,
        expiresAt: new Date(now.getTime() + pendingRegistrationTtlMs),
        resendAvailableAt: new Date(now.getTime() + resendCooldownMs)
      }
    });

    return {
      success: true,
      resendAvailableAt: updatedPending.resendAvailableAt.toISOString()
    } as const;
  } catch {
    return {
      success: false,
      error: "Не удалось отправить код через Telegram. Попробуйте позже."
    } as const;
  }
}

export async function verifyRegistrationCodeAction({ pendingRegistrationId, code }: VerificationInput) {
  if (!canUseDatabase()) {
    return { success: false, error: "DATABASE_URL is not configured" } as const;
  }

  if (!/^\d{6}$/.test(code)) {
    return { success: false, error: "Введите шестизначный код" } as const;
  }

  const now = new Date();
  const pending = await prisma.pendingRegistration.findUnique({ where: { id: pendingRegistrationId } });

  if (!pending || pending.expiresAt <= now || !pending.telegramGatewayRequestId) {
    return { success: false, error: "Время подтверждения истекло. Начните регистрацию заново." } as const;
  }

  const incremented = await prisma.pendingRegistration.updateMany({
    where: {
      id: pending.id,
      expiresAt: { gt: now },
      attempts: { lt: maxVerificationAttempts },
      telegramGatewayRequestId: pending.telegramGatewayRequestId
    },
    data: { attempts: { increment: 1 } }
  });

  if (incremented.count !== 1) {
    return { success: false, error: "Превышено число попыток. Запросите новый код." } as const;
  }

  let verificationStatus;
  try {
    verificationStatus = await checkTelegramGatewayVerification(
      pending.telegramGatewayRequestId,
      code
    );
  } catch {
    return { success: false, error: "Не удалось проверить код. Попробуйте ещё раз." } as const;
  }

  if (verificationStatus !== "code_valid") {
    if (verificationStatus === "expired") {
      return { success: false, error: "Срок действия кода истёк. Запросите новый код." } as const;
    }
    if (verificationStatus === "code_max_attempts_exceeded") {
      return { success: false, error: "Превышено число попыток. Запросите новый код." } as const;
    }
    return { success: false, error: "Неверный код. Попробуйте ещё раз." } as const;
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const currentPending = await transaction.pendingRegistration.findUnique({
        where: { id: pending.id }
      });

      if (
        !currentPending ||
        currentPending.expiresAt <= new Date() ||
        currentPending.telegramGatewayRequestId !== pending.telegramGatewayRequestId
      ) {
        throw new Error("PENDING_REGISTRATION_EXPIRED");
      }

      const phoneOwner = await transaction.user.findUnique({
        where: { phone: currentPending.phone },
        select: { id: true }
      });
      if (phoneOwner) {
        throw new Error("PHONE_ALREADY_REGISTERED");
      }

      const user = await transaction.user.create({
        data: {
          name: currentPending.name,
          phone: currentPending.phone,
          passwordHash: currentPending.passwordHash,
          phoneVerifiedAt: new Date(),
          role: currentPending.role
        }
      });

      if (currentPending.role === "PHOTOGRAPHER" || currentPending.role === "EDITOR") {
        await transaction.photographerProfile.create({
          data: {
            userId: user.id,
            name: currentPending.name,
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

      await transaction.legalAcceptance.createMany({
        data: [
          {
            userId: user.id,
            documentType: LegalDocumentType.TERMS,
            documentVersion: currentPending.acceptedTermsVersion,
            source: "registration"
          },
          {
            userId: user.id,
            documentType: LegalDocumentType.PRIVACY,
            documentVersion: currentPending.acceptedPrivacyVersion,
            source: "registration"
          }
        ]
      });

      await transaction.pendingRegistration.delete({ where: { id: currentPending.id } });

      return {
        redirectTo: registrationRedirect(currentPending.role as RegistrationRole)
      };
    });

    return { success: true, ...result } as const;
  } catch (error) {
    if (isUniqueViolation(error) || (error instanceof Error && error.message === "PHONE_ALREADY_REGISTERED")) {
      return { success: false, error: "Этот номер телефона уже зарегистрирован" } as const;
    }
    if (error instanceof Error && error.message === "PENDING_REGISTRATION_EXPIRED") {
      return { success: false, error: "Время подтверждения истекло. Начните регистрацию заново." } as const;
    }
    if (isRetryablePendingRegistrationError(error)) {
      return { success: false, error: "Регистрация уже завершена. Войдите с номером и паролем." } as const;
    }

    throw error;
  }
}
