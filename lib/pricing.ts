export interface BookingPricingInput {
  photographerPrice: number;
  studioPrice: number;
  durationHours: number;
}

export function calculateServiceFee(input: Pick<BookingPricingInput, "photographerPrice" | "studioPrice">) {
  return Math.round((input.photographerPrice + input.studioPrice) * 0.1);
}

export function calculateDepositAmount(totalPrice: number) {
  if (totalPrice <= 10000) {
    return totalPrice;
  }

  return Math.max(Math.round(totalPrice * 0.2), 10000);
}

export function calculateBookingPricing(input: BookingPricingInput) {
  const photographerTotal = input.photographerPrice * input.durationHours;
  const studioTotal = input.studioPrice * input.durationHours;
  const serviceFee = calculateServiceFee({
    photographerPrice: photographerTotal,
    studioPrice: studioTotal
  });
  const totalPrice = photographerTotal + studioTotal + serviceFee;
  const depositAmount = calculateDepositAmount(totalPrice);

  return {
    photographerTotal,
    studioTotal,
    serviceFee,
    totalPrice,
    depositAmount,
    paidAmount: 0,
    remainingAmount: totalPrice
  };
}
