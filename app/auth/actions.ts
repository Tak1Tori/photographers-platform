"use server";

import { hash } from "bcryptjs";
import { UserRole } from "@prisma/client";
import { canUseDatabase } from "@/lib/data/db";
import { prisma } from "@/lib/prisma";

interface RegisterInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: "CLIENT" | "PHOTOGRAPHER" | "STUDIO_OWNER";
}

export async function registerUserAction(input: RegisterInput) {
  if (!canUseDatabase()) {
    return { success: false, error: "DATABASE_URL is not configured" };
  }

  const name = input.name.trim();
  const email = input.email.toLowerCase().trim();
  const phone = input.phone?.trim();
  const password = input.password;
  const role = input.role;

  if (!name) {
    return { success: false, error: "Name is required" };
  }

  if (!email || !email.includes("@")) {
    return { success: false, error: "Valid email is required" };
  }

  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" };
  }

  if (!["CLIENT", "PHOTOGRAPHER", "STUDIO_OWNER"].includes(role)) {
    return { success: false, error: "Invalid role" };
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    return { success: false, error: "Email is already taken" };
  }

  const passwordHash = await hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      passwordHash,
      role: role as UserRole
    }
  });

  if (role === "PHOTOGRAPHER") {
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

  if (role === "STUDIO_OWNER") {
    await prisma.studioProfile.create({
      data: {
        ownerId: user.id,
        name: `${name} Studio`,
        city: "Алматы",
        address: "Заполните адрес студии",
        description: "Заполните описание студии.",
        rules: "Заполните правила аренды",
        status: "DRAFT"
      }
    });
  }

  return {
    success: true,
    redirectTo:
      role === "PHOTOGRAPHER"
        ? "/dashboard/photographer"
        : role === "STUDIO_OWNER"
          ? "/dashboard/studio"
          : "/"
  };
}
