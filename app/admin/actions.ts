"use server";

import { BookingStatus, ProfileStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { canUseDatabase } from "@/lib/data/db";
import {
  notifyBookingStatusChanged,
  notifyPaymentRefunded
} from "@/lib/notifications/notification-service";
import {
  cancelPayment,
  markPaymentAsFailed,
  refundManualPayment
} from "@/lib/payments/payment-service";
import { prisma } from "@/lib/prisma";

type ActionResult = { success: boolean; error?: string };

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

    revalidatePath("/admin");
    revalidatePath("/photographers");
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
    if (booking?.status !== status) {
      await notifyBookingStatusChanged(id, status);
    }

    revalidatePath("/admin");
    revalidatePath("/dashboard/photographer");
    revalidatePath("/dashboard/studio");
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
