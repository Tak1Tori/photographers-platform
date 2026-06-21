import type { BookingType } from "@prisma/client";

const BASIS_POINTS = 10_000;

export interface BookingPricingInput {
  bookingType?: BookingType;
  photographerPrice: number;
  studioPrice: number;
  durationHours: number;
}

export interface CommissionInput {
  bookingType: BookingType;
  photographerPrice: number;
  studioPrice: number;
}

export function calculatePlatformCommission(input: CommissionInput) {
  assertMoney(input.photographerPrice, "photographerPrice");
  assertMoney(input.studioPrice, "studioPrice");

  if (input.bookingType === "PHOTOGRAPHER_ONLY") {
    return percentageOf(input.photographerPrice, 1_000);
  }

  if (input.bookingType === "STUDIO_ONLY") {
    return Math.max(percentageOf(input.studioPrice, 800), input.studioPrice > 0 ? 1_000 : 0);
  }

  return percentageOf(input.photographerPrice + input.studioPrice, 1_200);
}

export function calculateServiceFee(
  input: Pick<BookingPricingInput, "photographerPrice" | "studioPrice"> & {
    bookingType?: BookingType;
  }
) {
  return calculatePlatformCommission({
    bookingType: input.bookingType ?? "FULL_SHOOT",
    photographerPrice: input.photographerPrice,
    studioPrice: input.studioPrice
  });
}

export function calculateDepositAmount(input: number | { bookingType: BookingType; totalPrice: number }) {
  const bookingType = typeof input === "number" ? "FULL_SHOOT" : input.bookingType;
  const totalPrice = typeof input === "number" ? input : input.totalPrice;
  assertMoney(totalPrice, "totalPrice");

  const percentage = bookingType === "STUDIO_ONLY" ? 5_000 : 2_000;
  const minimum = bookingType === "STUDIO_ONLY" ? 5_000 : 10_000;
  return Math.min(totalPrice, Math.max(percentageOf(totalPrice, percentage), minimum));
}

export function calculateFinalPaymentAmount(booking: {
  totalPrice: number;
  paidAmount: number;
  remainingAmount: number;
}) {
  assertMoney(booking.totalPrice, "totalPrice");
  assertMoney(booking.paidAmount, "paidAmount");
  assertMoney(booking.remainingAmount, "remainingAmount");
  return Math.min(Math.max(booking.totalPrice - booking.paidAmount, 0), booking.remainingAmount);
}

export function calculateProviderFeeEstimate(amount: number) {
  assertMoney(amount, "amount");
  return percentageOf(amount, 300);
}

export function calculateNetPlatformRevenue(input: {
  platformCommission: number;
  providerFee: number;
}) {
  assertMoney(input.platformCommission, "platformCommission");
  assertMoney(input.providerFee, "providerFee");
  return input.platformCommission - input.providerFee;
}

export function calculateBookingPricing(input: BookingPricingInput) {
  const bookingType = input.bookingType ?? "FULL_SHOOT";
  const photographerTotal = input.photographerPrice * input.durationHours;
  const studioTotal = input.studioPrice * input.durationHours;
  const platformCommission = calculatePlatformCommission({
    bookingType,
    photographerPrice: photographerTotal,
    studioPrice: studioTotal
  });
  const totalPrice = photographerTotal + studioTotal + platformCommission;
  const depositAmount = calculateDepositAmount({ bookingType, totalPrice });

  return {
    photographerTotal,
    studioTotal,
    serviceFee: platformCommission,
    platformCommission,
    totalPrice,
    depositAmount,
    paidAmount: 0,
    remainingAmount: totalPrice,
    providerFee: 0,
    netPlatformRevenue: platformCommission
  };
}

function percentageOf(amount: number, basisPoints: number) {
  return Math.floor((amount * basisPoints + BASIS_POINTS / 2) / BASIS_POINTS);
}

function assertMoney(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer amount in KZT`);
  }
}
