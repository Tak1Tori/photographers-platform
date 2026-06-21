import { createHmac, timingSafeEqual } from "node:crypto";

export function createHmacSignature(payload: string, secret: string, algorithm = "sha256") {
  return createHmac(algorithm, secret).update(payload, "utf8").digest("hex");
}

export function safeCompareSignatures(expected: string, received: string | null) {
  if (!received) return false;

  const expectedBuffer = Buffer.from(normalizeSignature(expected), "utf8");
  const receivedBuffer = Buffer.from(normalizeSignature(received), "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function requireIntegerMoney(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer amount`);
  }
}

export function requireKzt(currency: string) {
  if (currency.toUpperCase() !== "KZT") {
    throw new Error("Only KZT payments are supported");
  }
}

function normalizeSignature(signature: string) {
  return signature.trim().replace(/^sha256=/i, "");
}
