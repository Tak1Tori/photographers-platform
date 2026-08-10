import type { Booking } from "@/lib/types";

type ProviderPayoutBreakdown = {
  photographerGross: number;
  studioGross: number;
  platformFee: number;
  photographerFeeShare: number;
  studioFeeShare: number;
  photographerPayout: number;
  studioPayout: number;
};

export function calculateProviderPayouts(booking: Booking): ProviderPayoutBreakdown {
  const photographerGross = Math.max(booking.photographerTotal, 0);
  const studioGross = Math.max(booking.studioTotal, 0);
  const serviceTotal = photographerGross + studioGross;
  const storedProviderAmount = booking.providerAmount ?? booking.remainingAmount;
  const platformFee = clampMoney(
    booking.platformFeeAmount ??
      booking.depositAmount ??
      booking.serviceFee ??
      Math.max(serviceTotal - storedProviderAmount, 0),
    serviceTotal
  );

  if (serviceTotal <= 0 || platformFee <= 0) {
    return {
      photographerGross,
      studioGross,
      platformFee: 0,
      photographerFeeShare: 0,
      studioFeeShare: 0,
      photographerPayout: photographerGross,
      studioPayout: studioGross
    };
  }

  const photographerFeeShare =
    photographerGross > 0
      ? Math.min(photographerGross, Math.round((platformFee * photographerGross) / serviceTotal))
      : 0;
  const studioFeeShare = Math.min(studioGross, platformFee - photographerFeeShare);

  return {
    photographerGross,
    studioGross,
    platformFee,
    photographerFeeShare,
    studioFeeShare,
    photographerPayout: Math.max(photographerGross - photographerFeeShare, 0),
    studioPayout: Math.max(studioGross - studioFeeShare, 0)
  };
}

function clampMoney(value: number, max: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.round(value), 0), Math.max(max, 0));
}
