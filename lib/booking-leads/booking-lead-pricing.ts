import { BookingType } from "@prisma/client";
import { calculateBookingPricing } from "@/lib/pricing";
import type { BookingLeadWithDetails } from "@/lib/booking-leads/types";

export function calculateBookingLeadPricing(lead: BookingLeadWithDetails) {
  const durationHours = Math.max((lead.parsedDurationMinutes ?? 60) / 60, 1);
  const photographerPrice =
    lead.bookingType === BookingType.PHOTOGRAPHER_ONLY
      ? lead.photographerProfile?.hourlyRate ?? 0
      : 0;
  const studioPrice =
    lead.bookingType === BookingType.STUDIO_ONLY ? lead.studioHall?.hourlyRate ?? 0 : 0;

  return calculateBookingPricing({
    bookingType: lead.bookingType,
    photographerPrice,
    studioPrice,
    durationHours
  });
}
