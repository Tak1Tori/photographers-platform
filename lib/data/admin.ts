import { canUseDatabase } from "@/lib/data/db";
import { mapBooking } from "@/lib/data/mappers";
import { autoCompletePastBookings } from "@/lib/bookings/status-service";
import { prisma } from "@/lib/prisma";

export async function getAdminUsers() {
  if (!canUseDatabase()) return [];

  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getAdminBookings() {
  if (!canUseDatabase()) return [];

  await autoCompletePastBookings();

  const bookings = await prisma.booking.findMany({
    include: {
      style: true,
      photographer: true,
      studio: true,
      studioHall: true
    },
    orderBy: { createdAt: "desc" }
  });

  return bookings.map(mapBooking);
}

export async function getAdminPhotographerProfiles() {
  if (!canUseDatabase()) return [];

  return prisma.photographerProfile.findMany({
    where: {
      user: {
        role: "PHOTOGRAPHER"
      }
    },
    include: {
      user: true,
      styles: true,
      bookings: true,
      portfolioItems: true,
      reviews: true
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getAdminEditorProfiles() {
  if (!canUseDatabase()) return [];

  return prisma.photographerProfile.findMany({
    where: {
      user: {
        role: "EDITOR"
      }
    },
    include: {
      user: true,
      editorTags: true,
      portfolioItems: true,
      reviews: true
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getAdminStyles() {
  if (!canUseDatabase()) return [];

  return prisma.style.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      _count: {
        select: {
          bookings: true,
          photographers: true
        }
      }
    },
    orderBy: { name: "asc" }
  });
}

export async function getAdminEditorTags() {
  if (!canUseDatabase()) return [];

  return prisma.editorTag.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      _count: {
        select: {
          editors: true
        }
      }
    },
    orderBy: { name: "asc" }
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
          name: true
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
