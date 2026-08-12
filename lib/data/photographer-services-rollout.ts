import { Prisma } from "@prisma/client";

const photographerServiceSchemaPattern =
  /PhotographerService|photographerService(?:Id|Title|Price|DurationMinutes)?/i;

/**
 * Keeps the pre-migration application readable during a staggered code/database rollout.
 * It must never turn unrelated database failures into empty UI states.
 */
export function isMissingPhotographerServiceSchema(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== "P2021" && error.code !== "P2022") {
    return false;
  }

  const metadata = Object.values(error.meta ?? {})
    .map((value) => String(value))
    .join(" ");

  return photographerServiceSchemaPattern.test(metadata);
}

export function rethrowUnexpectedDatabaseError(context: string, error: unknown): never {
  console.error(`${context}: unexpected database error`, error);
  throw error;
}
