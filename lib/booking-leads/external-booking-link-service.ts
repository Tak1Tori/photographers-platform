import crypto from "crypto";

export function createPublicBookingToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function externalBookingUrl(token: string) {
  return `${getAppUrl()}/external-booking/${encodeURIComponent(token)}`;
}

export function bookingLeadLinkExpiresAt() {
  return new Date(Date.now() + 2 * 60 * 60_000);
}

export function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
