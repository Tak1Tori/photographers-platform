"use server";

import { hash } from "bcryptjs";
import { LegalDocumentType, Prisma, UserRole } from "@prisma/client";
import { canUseDatabase } from "@/lib/data/db";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

interface RegisterInput {
  name: string;
  phone: string;
  password: string;
  role: "CLIENT" | "PHOTOGRAPHER" | "EDITOR";
  acceptedLegal: boolean;
}

export async function registerUserAction(input: RegisterInput) {
  if (!canUseDatabase()) {
    return { success: false, error: "DATABASE_URL is not configured" };
  }

  const name = input.name.trim();
  const phone = normalizePhone(input.phone);
  const password = input.password;
  const role = input.role;

  if (!name) {
    return { success: false, error: "Name is required" };
  }

  if (!phone) {
    return { success: false, error: "Укажите корректный номер телефона" };
  }

  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" };
  }

  if (!["CLIENT", "PHOTOGRAPHER", "EDITOR"].includes(role)) {
    return { success: false, error: "Invalid role" };
  }

  if (!input.acceptedLegal) {
    return { success: false, error: "Подтвердите согласие с условиями Framely." };
  }

  const existingUser = await prisma.user.findUnique({ where: { phone } });

  if (existingUser) {
    return { success: false, error: "Этот номер телефона уже зарегистрирован" };
  }

  const passwordHash = await hash(password, 12);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        name,
        phone,
        passwordHash,
        role: role as UserRole
      }
    });
  } catch (error) {
    // The read above is only for a clear fast-path. The database unique key
    // remains the final protection when two registrations race each other.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "Этот номер телефона уже зарегистрирован" };
    }

    throw error;
  }

  if (role === "PHOTOGRAPHER" || role === "EDITOR") {
    await prisma.photographerProfile.create({
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

  await prisma.legalAcceptance.createMany({
    data: [
      {
        userId: user.id,
        documentType: LegalDocumentType.TERMS,
        documentVersion: "2026-08-05",
        source: "registration"
      },
      {
        userId: user.id,
        documentType: LegalDocumentType.PRIVACY,
        documentVersion: "2026-08-03",
        source: "registration"
      }
    ],
    skipDuplicates: true
  });

  return {
    success: true,
    redirectTo: role === "PHOTOGRAPHER" ? "/dashboard/photographer" : "/"
  };
}
