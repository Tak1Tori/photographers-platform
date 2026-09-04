import assert from "node:assert/strict";
import test from "node:test";
import { BookingType } from "@prisma/client";
import {
  calculateBookingPricing,
  calculatePlatformCommission,
  MAX_PLATFORM_FEE_AMOUNT
} from "@/lib/pricing";

test("platform fee is ten percent below the cap", () => {
  assert.equal(
    calculatePlatformCommission({
      bookingType: BookingType.PHOTOGRAPHER_ONLY,
      photographerPrice: 50_000,
      studioPrice: 0
    }),
    5_000
  );
});

test("platform fee reaches the cap at 70,000 KZT", () => {
  assert.equal(
    calculatePlatformCommission({
      bookingType: BookingType.FULL_SHOOT,
      photographerPrice: 50_000,
      studioPrice: 20_000
    }),
    MAX_PLATFORM_FEE_AMOUNT
  );
});

test("platform fee never exceeds 7,000 KZT", () => {
  assert.equal(
    calculatePlatformCommission({
      bookingType: BookingType.STUDIO_ONLY,
      photographerPrice: 0,
      studioPrice: 200_000
    }),
    MAX_PLATFORM_FEE_AMOUNT
  );
});

test("booking pricing applies the cap to the total service cost", () => {
  const pricing = calculateBookingPricing({
    bookingType: BookingType.FULL_SHOOT,
    photographerPrice: 40_000,
    studioPrice: 20_000,
    durationHours: 2
  });

  assert.equal(pricing.totalServicePrice, 120_000);
  assert.equal(pricing.platformFeeAmount, MAX_PLATFORM_FEE_AMOUNT);
  assert.equal(pricing.providerAmount, 113_000);
});
