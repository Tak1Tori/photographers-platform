"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createBusyEventFromBookingLead,
  createExternalBookingLinkForLead,
  rejectBookingLead,
  convertBookingLeadToBooking
} from "@/lib/booking-leads/booking-lead-service";
import { getSession } from "@/lib/auth";

export async function submitExternalBookingLeadAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const clientName = String(formData.get("clientName") ?? "").trim();
  const clientPhone = String(formData.get("clientPhone") ?? "").trim();
  const clientComment = String(formData.get("clientComment") ?? "").trim();

  if (!token || !clientName || !clientPhone) {
    throw new Error("Заполните имя и телефон.");
  }

  const { paymentSession } = await convertBookingLeadToBooking(token, {
    clientName,
    clientPhone,
    clientEmail: "",
    clientComment: clientComment || undefined
  });
  redirect(paymentSession.checkoutUrl);
}

export async function createBookingLeadLinkAction(formData: FormData) {
  await requireProviderSession();
  const leadId = String(formData.get("leadId") ?? "");
  if (!leadId) throw new Error("Lead id is required.");
  await createExternalBookingLinkForLead(leadId);
  revalidateCalendarPages();
}

export async function rejectBookingLeadAction(formData: FormData) {
  await requireProviderSession();
  const leadId = String(formData.get("leadId") ?? "");
  if (!leadId) throw new Error("Lead id is required.");
  await rejectBookingLead(leadId);
  revalidateCalendarPages();
}

export async function createBusyFromBookingLeadAction(formData: FormData) {
  await requireProviderSession();
  const leadId = String(formData.get("leadId") ?? "");
  if (!leadId) throw new Error("Lead id is required.");
  await createBusyEventFromBookingLead(leadId);
  revalidateCalendarPages();
}

async function requireProviderSession() {
  const session = await getSession();
  if (!session?.user.id) {
    throw new Error("Нужно войти в аккаунт.");
  }
  return session;
}

function revalidateCalendarPages() {
  revalidatePath("/dashboard/photographer/calendar");
  revalidatePath("/dashboard/studio/calendar");
  revalidatePath("/admin");
}
