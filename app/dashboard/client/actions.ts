"use server";

import { Prisma, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  cancelClientBooking,
  createClientReview,
  requestBookingReschedule
} from "@/lib/data/client";
import { getSession } from "@/lib/auth";
import {
  notifyBookingStatusChanged,
  notifyRescheduleRequested,
  notifyReviewCreated
} from "@/lib/notifications/notification-service";
import { BookingStatus } from "@prisma/client";
import { createPlatformFeePaymentForBooking } from "@/lib/payments/payment-service";
import { prisma } from "@/lib/prisma";
import { canUseDatabase } from "@/lib/data/db";
import { normalizePhone } from "@/lib/phone";
import {
  avatarImageMaxBytes,
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
  validateImageFile
} from "@/lib/uploads";

type ActionResult = {
  success: boolean;
  message?: string;
  error?: string;
};

type UpdateClientProfileResult = ActionResult & {
  account?: {
    name: string;
    phone?: string | null;
    image?: string | null;
  };
};

async function requireClientAccess() {
  const session = await getSession();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  if (session.user.role !== UserRole.CLIENT && session.user.role !== UserRole.ADMIN) {
    throw new Error("Access denied");
  }

  return session;
}

export async function cancelClientBookingAction(bookingNumber: string): Promise<ActionResult> {
  try {
    const session = await requireClientAccess();
    const result = await cancelClientBooking(session.user.id, bookingNumber, session.user.role);
    if (result.bookingId) await notifyBookingStatusChanged(result.bookingId, BookingStatus.CANCELLED);
    revalidateClientBookingPaths(bookingNumber);
    return {
      success: true,
      message:
        result.refundOutcome === "refunded"
          ? "Бронь отменена. Сервисный сбор возвращен."
          : result.refundOutcome === "refund_requested"
            ? "Бронь отменена. Запрос на возврат сервисного сбора передан в обработку."
            : result.refundOutcome === "non_refundable"
              ? "Бронь отменена. Сервисный сбор не подлежит возврату при отмене менее чем за 24 часа до начала."
              : "Бронь отменена."
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Не удалось отменить бронь"
    };
  }
}

export async function requestBookingRescheduleAction(
  bookingNumber: string,
  requestedDate: string,
  requestedTime: string,
  comment: string
): Promise<ActionResult> {
  try {
    const session = await requireClientAccess();
    const date = requestedDate.trim();
    const time = requestedTime.trim();
    const note = comment.trim();

    if (!date) return { success: false, error: "Выберите новую дату." };
    if (!time) return { success: false, error: "Выберите новое время." };

    const bookingId = await requestBookingReschedule(
      session.user.id,
      bookingNumber,
      { date, startTime: time, comment: note },
      session.user.role
    );
    if (bookingId) await notifyRescheduleRequested(bookingId);
    revalidateClientBookingPaths(bookingNumber);
    revalidatePath("/dashboard/photographer");
    revalidatePath("/dashboard/photographer/calendar");
    return { success: true, message: "Запрос на перенос отправлен." };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Не удалось отправить запрос"
    };
  }
}

export async function createClientReviewAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireClientAccess();
    const bookingNumber = String(formData.get("bookingNumber") ?? "");
    const rating = Number(formData.get("rating") ?? 5);
    const comment = String(formData.get("comment") ?? "");
    const reviewPhotographer = formData.get("reviewPhotographer") === "on";
    const reviewStudio = formData.get("reviewStudio") === "on";

    const reviewId = await createClientReview(
      session.user.id,
      {
        bookingNumber,
        rating,
        comment,
        reviewPhotographer,
        reviewStudio
      },
      session.user.role
    );
    if (reviewId) {
      await notifyReviewCreated(reviewId);
      await revalidateReviewTargets(reviewId);
    }

    revalidateClientBookingPaths(bookingNumber);
    return { success: true, message: "Отзыв сохранен." };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Не удалось сохранить отзыв"
    };
  }
}

export async function openFinalPaymentCheckoutAction(
  bookingNumber: string
): Promise<ActionResult & { checkoutUrl?: string }> {
  void bookingNumber;
  return {
    success: false,
    error: "Остаток оплачивается напрямую исполнителю. Платформа принимает только сервисный сбор."
  };
}

export async function openDepositPaymentCheckoutAction(
  bookingNumber: string
): Promise<ActionResult & { checkoutUrl?: string }> {
  try {
    const session = await requireClientAccess();

    if (!canUseDatabase()) {
      return { success: false, error: "DATABASE_URL не настроен. Оплата требует БД." };
    }

    const booking = await prisma.booking.findFirst({
      where: {
        bookingNumber,
        ...(session.user.role === UserRole.ADMIN
          ? {}
          : { clientId: session.user.id })
      },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        platformFeeAmount: true,
        platformFeeStatus: true,
        depositAmount: true,
        paidAmount: true
      }
    });

    if (!booking) throw new Error("Booking not found");
    if (
      [
        "CANCELLED",
        "CANCELLED_BY_CLIENT",
        "CANCELLED_BY_PROVIDER",
        "CANCELLED_BY_PLATFORM",
        "DECLINED",
        "COMPLETED"
      ].includes(booking.status)
    ) {
      throw new Error("Оплата сервисного сбора недоступна для этой брони");
    }
    if (booking.platformFeeStatus === "PAID") {
      throw new Error("Сервисный сбор уже оплачен");
    }
    if (!["UNPAID", "DEPOSIT_PENDING", "FAILED"].includes(booking.paymentStatus)) {
      throw new Error("Оплата сервисного сбора недоступна для этой брони");
    }
    const feeAmount = booking.platformFeeAmount || booking.depositAmount;
    if (feeAmount <= 0 || booking.paidAmount >= feeAmount) {
      throw new Error("Сервисный сбор уже оплачен");
    }

    const checkout = await createPlatformFeePaymentForBooking(booking.id);
    return { success: true, checkoutUrl: checkout.checkoutUrl };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Не удалось открыть оплату сервисного сбора"
    };
  }
}

export async function updateClientProfileAction(
  formData: FormData
): Promise<UpdateClientProfileResult> {
  let newAvatarPublicId: string | undefined;
  let avatarSaved = false;

  try {
    const session = await requireClientAccess();

    if (!canUseDatabase()) {
      return { success: false, error: "DATABASE_URL не настроен. Сохранение профиля требует БД." };
    }

    const name = String(formData.get("name") ?? "").trim();
    const phoneInput = String(formData.get("phone") ?? "").trim();
    const phone = phoneInput ? normalizePhone(phoneInput) : null;
    const avatarFile = formData.get("avatar") as File | null;
    const hasNewAvatar = Boolean(avatarFile?.size);
    let image: string | null | undefined;

    if (!name) return { success: false, error: "Введите имя." };
    if (phoneInput && !phone) return { success: false, error: "Укажите корректный номер телефона Казахстана." };
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { image: true, phone: true }
    });

    if (hasNewAvatar && avatarFile) {
      const validation = validateImageFile(avatarFile, avatarImageMaxBytes);

      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const uploaded = await uploadImageToCloudinary(
        avatarFile,
        "accounts/avatars",
        avatarImageMaxBytes
      );
      image = uploaded.secureUrl;
      newAvatarPublicId = uploaded.publicId;
    }

    let user;
    try {
      user = await prisma.user.update({
        where: { id: session.user.id },
        data: {
          name,
          phone,
          ...(phone !== currentUser?.phone ? { phoneVerifiedAt: null } : {}),
          ...(image ? { image } : {})
        },
        select: {
          name: true,
          phone: true,
          image: true
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { success: false, error: "Этот номер телефона уже используется другим аккаунтом." };
      }

      throw error;
    }
    avatarSaved = true;

    if (newAvatarPublicId && currentUser?.image) {
      await deleteImageFromCloudinary(extractManagedPublicId(currentUser.image));
    }

    revalidatePath("/dashboard/client");
    revalidatePath("/dashboard/client/edit");
    revalidatePath("/dashboard/client/bookings");

    return {
      success: true,
      message: "Данные профиля сохранены.",
      account: user
    };
  } catch (error) {
    if (newAvatarPublicId && !avatarSaved) {
      await deleteImageFromCloudinary(newAvatarPublicId);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Не удалось сохранить профиль"
    };
  }
}

function extractManagedPublicId(imageUrl: string | null | undefined) {
  if (!imageUrl) return undefined;
  if (imageUrl.startsWith("/uploads/")) return `local:${imageUrl.replace("/uploads/", "")}`;
  return undefined;
}

async function revalidateReviewTargets(reviewId: string) {
  if (!canUseDatabase()) return;

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: {
      photographerId: true,
      studioId: true
    }
  });

  if (review?.photographerId) {
    revalidatePath("/photographers");
    revalidatePath(`/photographers/${review.photographerId}`);
  }
  if (review?.studioId) {
    revalidatePath(`/studios/${review.studioId}`);
  }
}

function revalidateClientBookingPaths(bookingNumber: string) {
  revalidatePath("/dashboard/client");
  revalidatePath("/dashboard/client/bookings");
  revalidatePath(`/dashboard/client/bookings/${bookingNumber}`);
  revalidatePath("/admin");
}
