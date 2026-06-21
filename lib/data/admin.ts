import { canUseDatabase } from "@/lib/data/db";
import { prisma } from "@/lib/prisma";

export async function getAdminUsers() {
  if (!canUseDatabase()) return [];

  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getAdminPhotographerProfiles() {
  if (!canUseDatabase()) return [];

  return prisma.photographerProfile.findMany({
    include: {
      user: true,
      styles: true,
      bookings: true,
      portfolioItems: true
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getAdminStudioProfiles() {
  if (!canUseDatabase()) return [];

  return prisma.studioProfile.findMany({
    include: {
      owner: true,
      halls: true,
      bookings: true
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getAdminStudioHalls() {
  if (!canUseDatabase()) return [];

  return prisma.studioHall.findMany({
    include: {
      studio: true
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getAdminPayments() {
  if (!canUseDatabase()) return [];

  return prisma.payment.findMany({
    include: {
      booking: true
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getAdminNotificationLogs() {
  if (!canUseDatabase()) return [];

  return prisma.notification.findMany({
    include: {
      user: {
        select: {
          name: true,
          email: true
        }
      },
      deliveryLogs: {
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });
}

export async function getAdminPaymentWebhookLogs() {
  if (!canUseDatabase()) return [];

  return prisma.paymentWebhookLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100
  });
}
