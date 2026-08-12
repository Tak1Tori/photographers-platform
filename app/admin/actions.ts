"use server";

import { BookingStatus, Prisma, ProfileStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { canUseDatabase } from "@/lib/data/db";
import {
  notifyBookingStatusChanged,
  notifyPaymentRefunded
} from "@/lib/notifications/notification-service";
import { cancelPlatformBookingEvent } from "@/lib/calendar/calendar-service";
import { cancelBookingHolds } from "@/lib/calendar/hold-service";
import { revalidatePhotographerPublicData } from "@/lib/data/photographers";
import {
  cancelPayment,
  markPaymentAsFailed,
  refundManualPayment
} from "@/lib/payments/payment-service";
import { prisma } from "@/lib/prisma";

type ActionResult = { success: boolean; error?: string };

const defaultStyleImageUrl =
  "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?auto=format&fit=crop&w=1200&q=80";

async function requireAdmin() {
  const session = await getSession();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  if (session.user.role !== UserRole.ADMIN) {
    throw new Error("Forbidden");
  }

  if (!canUseDatabase()) {
    throw new Error("DATABASE_URL is not configured");
  }

  return session;
}

export async function updatePhotographerProfileStatusAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const id = String(formData.get("id") ?? "");
    const status = String(formData.get("status") ?? "") as ProfileStatus;

    if (![ProfileStatus.PUBLISHED, ProfileStatus.BLOCKED, ProfileStatus.DRAFT].includes(status)) {
      return { success: false, error: "Invalid profile status." };
    }

    await prisma.photographerProfile.update({
      where: { id },
      data: { status }
    });

    revalidatePhotographerPublicData(id);
    revalidatePath("/admin");
    revalidatePath("/photographers");
    revalidatePath("/editors");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateStudioProfileStatusAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const id = String(formData.get("id") ?? "");
    const status = String(formData.get("status") ?? "") as ProfileStatus;

    if (![ProfileStatus.PUBLISHED, ProfileStatus.BLOCKED, ProfileStatus.DRAFT].includes(status)) {
      return { success: false, error: "Invalid profile status." };
    }

    await prisma.studioProfile.update({
      where: { id },
      data: { status }
    });

    revalidatePath("/admin");
    revalidatePath("/studios");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function adminCreatePhotographerReviewAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const photographerId = String(formData.get("photographerId") ?? "");
    const clientName = String(formData.get("clientName") ?? "").trim();
    const comment = String(formData.get("comment") ?? "").trim();
    const rating = Number(formData.get("rating") ?? 0);
    const reviewDate = String(formData.get("reviewDate") ?? "").trim();
    const createdAt = reviewDate ? new Date(`${reviewDate}T12:00:00.000Z`) : null;

    if (!photographerId) return { success: false, error: "Выберите фотографа." };
    if (!clientName) return { success: false, error: "Укажите имя клиента." };
    if (!createdAt || Number.isNaN(createdAt.getTime())) {
      return { success: false, error: "Укажите дату отзыва." };
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return { success: false, error: "Оценка должна быть от 1 до 5." };
    }

    await prisma.review.create({
      data: {
        photographerId,
        clientName,
        rating,
        comment: comment || null,
        createdAt
      }
    });

    revalidatePath("/admin");
    revalidatePath("/photographers");
    revalidatePath(`/photographers/${photographerId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function adminDeleteReviewAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const reviewId = String(formData.get("reviewId") ?? "");

    if (!reviewId) {
      return { success: false, error: "Отзыв не найден." };
    }

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        photographerId: true,
        studioId: true
      }
    });

    if (!review) {
      return { success: false, error: "Отзыв не найден." };
    }

    await prisma.review.delete({
      where: { id: reviewId }
    });

    revalidatePath("/admin");
    if (review.photographerId) {
      revalidatePath("/photographers");
      revalidatePath(`/photographers/${review.photographerId}`);
    }
    if (review.studioId) {
      revalidatePath("/studios");
      revalidatePath(`/studios/${review.studioId}`);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function adminDeleteUserAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    const userId = String(formData.get("userId") ?? "");

    if (!userId) {
      return { success: false, error: "Пользователь не найден." };
    }

    if (session.user.id === userId) {
      return { success: false, error: "Нельзя удалить текущий аккаунт администратора." };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        photographerProfile: {
          select: { id: true }
        },
        studioProfiles: {
          select: {
            id: true,
            halls: {
              select: { id: true }
            }
          }
        }
      }
    });

    if (!user) {
      return { success: false, error: "Пользователь не найден." };
    }

    const photographerId = user.photographerProfile?.id;
    const studioIds = user.studioProfiles.map((studio) => studio.id);
    const hallIds = user.studioProfiles.flatMap((studio) => studio.halls.map((hall) => hall.id));
    const bookingFilters: Prisma.BookingWhereInput[] = [{ clientId: user.id }];

    if (user.email) bookingFilters.push({ clientEmail: user.email });
    if (user.phone) bookingFilters.push({ clientPhone: user.phone });
    if (photographerId) bookingFilters.push({ photographerId });
    if (studioIds.length > 0) bookingFilters.push({ studioId: { in: studioIds } });
    if (hallIds.length > 0) bookingFilters.push({ studioHallId: { in: hallIds } });

    const reviewFilters: Prisma.ReviewWhereInput[] = [];
    if (photographerId) reviewFilters.push({ photographerId });
    if (studioIds.length > 0) reviewFilters.push({ studioId: { in: studioIds } });
    if (user.name) reviewFilters.push({ clientName: user.name });

    await prisma.$transaction(async (tx) => {
      const bookingIds = (
        await tx.booking.findMany({
          where: { OR: bookingFilters },
          select: { id: true }
        })
      ).map((booking) => booking.id);

      if (bookingIds.length > 0) {
        await tx.booking.deleteMany({
          where: { id: { in: bookingIds } }
        });
      }

      if (reviewFilters.length > 0) {
        await tx.review.deleteMany({
          where: { OR: reviewFilters }
        });
      }

      await tx.user.delete({
        where: { id: userId }
      });
    });

    revalidatePath("/admin");
    revalidatePath("/photographers");
    revalidatePath("/studios");
    revalidatePath("/dashboard/client");
    revalidatePath("/dashboard/photographer");
    revalidatePath("/dashboard/studio");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function adminCreateStyleAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const name = String(formData.get("name") ?? "").trim();

    if (!name) return { success: false, error: "Название тега обязательно." };

    const slug = slugify(name);
    const existing = await prisma.style.findFirst({
      where: {
        OR: [
          { name: { equals: name, mode: "insensitive" } },
          { slug }
        ]
      }
    });

    if (existing) {
      return { success: false, error: "Такой тег уже есть." };
    }

    await prisma.style.create({
      data: {
        name,
        slug,
        description: "Пользовательский тег съемки",
        startingPrice: 0,
        imageUrl: defaultStyleImageUrl
      }
    });

    revalidatePath("/admin");
    revalidatePath("/photographers");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function adminDeleteStyleAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const styleId = String(formData.get("styleId") ?? "");

    if (!styleId) return { success: false, error: "Тег не найден." };

    const style = await prisma.style.findUnique({
      where: { id: styleId },
      select: {
        id: true,
        _count: {
          select: {
            bookings: true,
            photographers: true
          }
        }
      }
    });

    if (!style) return { success: false, error: "Тег не найден." };
    if (style._count.bookings > 0) {
      return {
        success: false,
        error: "Нельзя удалить тег, который уже используется в бронях."
      };
    }

    const linkedPhotographers = await prisma.photographerProfile.findMany({
      where: { styles: { some: { id: styleId } } },
      select: { id: true }
    });

    await prisma.$transaction([
      ...linkedPhotographers.map((profile) =>
        prisma.photographerProfile.update({
          where: { id: profile.id },
          data: { styles: { disconnect: [{ id: styleId }] } }
        })
      ),
      prisma.style.delete({ where: { id: styleId } })
    ]);

    revalidatePath("/admin");
    revalidatePath("/photographers");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function adminCreateEditorTagAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const name = String(formData.get("name") ?? "").trim();

    if (!name) return { success: false, error: "Название тега обязательно." };

    const slug = slugify(name);
    const existing = await prisma.editorTag.findFirst({
      where: {
        OR: [{ name: { equals: name, mode: "insensitive" } }, { slug }]
      }
    });

    if (existing) return { success: false, error: "Такой тег уже есть." };

    await prisma.editorTag.create({ data: { name, slug } });
    revalidatePath("/admin");
    revalidatePath("/editors");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function adminDeleteEditorTagAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const editorTagId = String(formData.get("editorTagId") ?? "");
    if (!editorTagId) return { success: false, error: "Тег не найден." };

    await prisma.editorTag.delete({ where: { id: editorTagId } });
    revalidatePath("/admin");
    revalidatePath("/editors");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function adminUpdateBookingStatusAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const id = String(formData.get("bookingId") ?? "");
    const status = String(formData.get("status") ?? "") as BookingStatus;

    if (!Object.values(BookingStatus).includes(status)) {
      return { success: false, error: "Invalid booking status." };
    }

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (
      status === BookingStatus.COMPLETED &&
      booking?.paymentStatus !== "FULLY_PAID"
    ) {
      return {
        success: false,
        error: "Нельзя завершить бронь до полной оплаты."
      };
    }

    // TODO: Позже разделить подтверждение на photographerConfirmationStatus и studioConfirmationStatus.
    await prisma.booking.update({
      where: { id },
      data: { status }
    });
    if (
      status === BookingStatus.CANCELLED ||
      status === BookingStatus.DECLINED
    ) {
      await Promise.all([
        cancelPlatformBookingEvent(id),
        cancelBookingHolds(id)
      ]);
    }
    if (status === BookingStatus.COMPLETED) {
      await cancelPlatformBookingEvent(id);
    }
    if (booking?.status !== status) {
      await notifyBookingStatusChanged(id, status);
    }

    revalidatePath("/admin");
    revalidatePath("/dashboard/photographer");
    revalidatePath("/dashboard/photographer/calendar");
    revalidatePath("/dashboard/studio");
    revalidatePath("/dashboard/studio/calendar");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function adminMarkPaymentAsFailedAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const session = await getSession();
    const paymentId = String(formData.get("paymentId") ?? "");
    await markPaymentAsFailed(paymentId, { actorId: session?.user.id });
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function adminCancelPaymentAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const session = await getSession();
    const paymentId = String(formData.get("paymentId") ?? "");
    await cancelPayment(paymentId, {
      actorId: session?.user.id,
      reason: "Cancelled manually by admin"
    });
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function adminRefundPaymentAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const session = await getSession();
    const paymentId = String(formData.get("paymentId") ?? "");
    const reason = String(formData.get("reason") ?? "Manual admin refund");
    const payment = await refundManualPayment(paymentId, session!.user.id, reason);
    if (payment?.bookingId) await notifyPaymentRefunded(payment.bookingId);
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || `style-${Date.now()}`;
}
