import { randomBytes } from "crypto";

export function createStudioConfirmationToken() {
  return randomBytes(32).toString("base64url");
}

export function createStudioConfirmationExpiration(minutes: number) {
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 30;
  return new Date(Date.now() + safeMinutes * 60 * 1000);
}
