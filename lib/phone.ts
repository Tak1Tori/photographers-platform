const KAZAKHSTAN_PHONE_PATTERN = /^7\d{10}$/;

/**
 * Converts Kazakhstan mobile numbers to the single format stored in User.phone.
 * Returns an empty string for values that cannot be safely treated as a KZ number.
 */
export function normalizePhone(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";

  if (KAZAKHSTAN_PHONE_PATTERN.test(digits)) return `+${digits}`;
  if (/^8\d{10}$/.test(digits)) return `+7${digits.slice(1)}`;
  if (/^\d{10}$/.test(digits)) return `+7${digits}`;

  return "";
}
