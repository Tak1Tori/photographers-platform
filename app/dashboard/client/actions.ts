"use server";

import { UserRole } from "@prisma/client";
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
import { getPendingFinalPaymentCheckout } from "@/lib/payments/payment-service";
import { prisma } from "@/lib/prisma";

type ActionResult = {
  success: boolean;
  message?: string;
  error?: string;
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
    const bookingId = await cancelClientBooking(session.user.id, bookingNumber, session.user.role);
    if (bookingId) await notifyBookingStatusChanged(bookingId, BookingStatus.CANCELLED);
    revalidateClientBookingPaths(bookingNumber);
    return {
      success: true,
      message: "Бронь отменена. Возврат депозита обрабатывается администратором вручную."
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
  comment: string
): Promise<ActionResult> {
  try {
    const session = await requireClientAccess();
    const bookingId = await requestBookingReschedule(session.user.id, bookingNumber, comment, session.user.role);
    if (bookingId) await notifyRescheduleRequested(bookingId);
    revalidateClientBookingPaths(bookingNumber);
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
    if (reviewId) await notifyReviewCreated(reviewId);

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
  try {
    const session = await requireClientAccess();
    const booking = await prisma.booking.findFirst({
      where: {
        bookingNumber,
        ...(session.user.role === UserRole.ADMIN
          ? {}
          : { clientId: session.user.id })
      },
      select: {
        id: true,
        paymentStatus: true,
        remainingAmount: true
      }
    });

    if (!booking) throw new Error("Booking not found");
    if (booking.paymentStatus !== "FINAL_PAYMENT_PENDING" || booking.remainingAmount <= 0) {
      throw new Error("Final payment is not available for this booking");
    }

    const checkout = await getPendingFinalPaymentCheckout(booking.id);
    return { success: true, checkoutUrl: checkout.checkoutUrl };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Не удалось открыть оплату"
    };
  }
}

function revalidateClientBookingPaths(bookingNumber: string) {
  revalidatePath("/dashboard/client");
  revalidatePath("/dashboard/client/bookings");
  revalidatePath(`/dashboard/client/bookings/${bookingNumber}`);
  revalidatePath("/admin");
}
