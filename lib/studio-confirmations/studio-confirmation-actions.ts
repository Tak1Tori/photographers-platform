"use server";

import {
  StudioConfirmationMode,
  StudioConfirmationRejectionReason,
  UserRole
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/guards";
import {
  acceptStudioConfirmationRequestByToken,
  acceptStudioConfirmationRequestFromDashboard,
  convertAcceptedStudioConfirmationToBooking,
  rejectStudioConfirmationRequestByToken,
  rejectStudioConfirmationRequestFromDashboard,
  updateStudioConfirmationSettings
} from "@/lib/studio-confirmations/studio-confirmation-service";

export async function acceptStudioConfirmationByTokenAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  await acceptStudioConfirmationRequestByToken(token);
  revalidatePath(`/studio-confirm/${token}`);
  redirect(`/studio-confirm/${token}?result=accepted`);
}

export async function rejectStudioConfirmationByTokenAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const reason = parseRejectionReason(formData.get("reason"));
  const comment = String(formData.get("comment") ?? "");
  await rejectStudioConfirmationRequestByToken(token, reason, comment);
  revalidatePath(`/studio-confirm/${token}`);
  redirect(`/studio-confirm/${token}?result=rejected`);
}

export async function acceptStudioConfirmationFromDashboardAction(formData: FormData) {
  const session = await requireSession([UserRole.STUDIO_OWNER, UserRole.ADMIN]);
  const requestId = String(formData.get("requestId") ?? "");
  await acceptStudioConfirmationRequestFromDashboard(
    requestId,
    session.user.id,
    session.user.role === UserRole.ADMIN
  );
  revalidateStudioConfirmationPages();
}

export async function rejectStudioConfirmationFromDashboardAction(formData: FormData) {
  const session = await requireSession([UserRole.STUDIO_OWNER, UserRole.ADMIN]);
  const requestId = String(formData.get("requestId") ?? "");
  const reason = parseRejectionReason(formData.get("reason"));
  const comment = String(formData.get("comment") ?? "");
  await rejectStudioConfirmationRequestFromDashboard(
    requestId,
    session.user.id,
    session.user.role === UserRole.ADMIN,
    reason,
    comment
  );
  revalidateStudioConfirmationPages();
}

export async function confirmAcceptedStudioRequestPaymentAction(formData: FormData) {
  const session = await requireSession([UserRole.CLIENT, UserRole.ADMIN]);
  const requestId = String(formData.get("requestId") ?? "");
  const { paymentSession } = await convertAcceptedStudioConfirmationToBooking(
    requestId,
    session.user.id,
    session.user.role === UserRole.ADMIN
  );
  revalidateStudioConfirmationPages();
  redirect(paymentSession.checkoutUrl);
}

export async function saveStudioConfirmationSettingsAction(formData: FormData) {
  const session = await requireSession([UserRole.STUDIO_OWNER, UserRole.ADMIN]);
  const studioId = String(formData.get("studioId") ?? "") || undefined;
  const mode = parseConfirmationMode(formData.get("confirmationMode"));
  const timeout = Number(formData.get("whatsappResponseTimeoutMinutes") ?? 30);

  await updateStudioConfirmationSettings(session.user.id, session.user.role === UserRole.ADMIN, {
    studioId,
    confirmationMode: mode,
    whatsappBookingPhone: String(formData.get("whatsappBookingPhone") ?? ""),
    whatsappContactName: String(formData.get("whatsappContactName") ?? ""),
    whatsappResponseTimeoutMinutes:
      Number.isInteger(timeout) && timeout >= 5 && timeout <= 1440 ? timeout : 30,
    whatsappConfirmationEnabled: formData.get("whatsappConfirmationEnabled") === "on"
  });

  revalidatePath("/dashboard/studio/settings/booking-confirmation");
  revalidatePath("/dashboard/studio");
}

function parseRejectionReason(value: FormDataEntryValue | null) {
  const raw = String(value ?? "");
  if (raw in StudioConfirmationRejectionReason) {
    return raw as StudioConfirmationRejectionReason;
  }
  return StudioConfirmationRejectionReason.OTHER;
}

function parseConfirmationMode(value: FormDataEntryValue | null) {
  const raw = String(value ?? "");
  if (raw in StudioConfirmationMode) {
    return raw as StudioConfirmationMode;
  }
  return StudioConfirmationMode.PLATFORM_CALENDAR_AUTO;
}

function revalidateStudioConfirmationPages() {
  revalidatePath("/dashboard/studio");
  revalidatePath("/dashboard/studio/requests");
  revalidatePath("/dashboard/client");
  revalidatePath("/admin");
  revalidatePath("/admin/studio-confirmations");
}
