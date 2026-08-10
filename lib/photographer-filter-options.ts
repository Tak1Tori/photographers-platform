export const PHOTOGRAPHER_MIN_PRICE = 0;
export const PHOTOGRAPHER_MAX_PRICE = 100_000;
export const PHOTOGRAPHER_PRICE_STEP = 5_000;

export function normalizePhotographerMaxPrice(value?: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return PHOTOGRAPHER_MAX_PRICE;
  return Math.min(Math.max(parsed, PHOTOGRAPHER_MIN_PRICE), PHOTOGRAPHER_MAX_PRICE);
}

export function normalizePhotographerRating(value?: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) return undefined;
  return parsed;
}
