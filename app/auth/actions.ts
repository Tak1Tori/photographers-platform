"use server";

import { hash } from "bcryptjs";
import { LegalDocumentType, Prisma } from "@prisma/client";
import { getDashboardHref } from "@/lib/auth";
import { canUseDatabase } from "@/lib/data/db";
import { privacyLegalDocument, legalDocuments } from "@/lib/legal-documents";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

type RegistrationRole = "CLIENT" | "PHOTOGRAPHER" | "EDITOR";

interface StartRegistrationInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: RegistrationRole;
  acceptedLegal: boolean;
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

function uniqueConstraintIncludes(error: unknown, field: "email" | "phone") {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes(field) : typeof target === "string" && target.includes(field);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function startRegistrationAction(input: StartRegistrationInput) {
  if (!canUseDatabase()) {
    return { success: false, error: "DATABASE_URL is not configured" } as const;
  }

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = normalizePhone(input.phone);
  const role = input.role;

  if (!name) {
    return { success: false, error: "Укажите имя" } as const;
  }

  if (!email || !isValidEmail(email)) {
    return { success: false, error: "Укажите корректный email" } as const;
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

  const [phoneOwner, emailOwner] = await Promise.all([
    prisma.user.findUnique({ where: { phone }, select: { id: true } }),
    prisma.user.findUnique({ where: { email }, select: { id: true } })
  ]);
  if (phoneOwner) {
    return { success: false, error: "Этот номер телефона уже зарегистрирован" } as const;
  }
  if (emailOwner) {
    return { success: false, error: "Этот email уже зарегистрирован" } as const;
  }

  const passwordHash = await hash(input.password, 12);
  const { terms, privacy } = getLegalVersions();

  try {
    await prisma.$transaction(async (transaction) => {
      const [phoneOwner, emailOwner] = await Promise.all([
        transaction.user.findUnique({
          where: { phone },
          select: { id: true }
        }),
        transaction.user.findUnique({
          where: { email },
          select: { id: true }
        })
      ]);
      if (phoneOwner) {
        throw new Error("PHONE_ALREADY_REGISTERED");
      }
      if (emailOwner) {
        throw new Error("EMAIL_ALREADY_REGISTERED");
      }

      const user = await transaction.user.create({
        data: {
          name,
          email,
          phone,
          passwordHash,
          role
        }
      });

      if (role === "PHOTOGRAPHER" || role === "EDITOR") {
        await transaction.photographerProfile.create({
          data: {
            userId: user.id,
            name,
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
            documentVersion: terms,
            source: "registration"
          },
          {
            userId: user.id,
            documentType: LegalDocumentType.PRIVACY,
            documentVersion: privacy,
            source: "registration"
          }
        ]
      });
    });

    return { success: true, redirectTo: registrationRedirect(role) } as const;
  } catch (error) {
    if (
      uniqueConstraintIncludes(error, "phone") ||
      (error instanceof Error && error.message === "PHONE_ALREADY_REGISTERED")
    ) {
      return { success: false, error: "Этот номер телефона уже зарегистрирован" } as const;
    }
    if (
      uniqueConstraintIncludes(error, "email") ||
      (error instanceof Error && error.message === "EMAIL_ALREADY_REGISTERED")
    ) {
      return { success: false, error: "Этот email уже зарегистрирован" } as const;
    }

    throw error;
  }
}
