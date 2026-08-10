import type { Session } from "next-auth";
import { canUseDatabase } from "@/lib/data/db";
import { prisma } from "@/lib/prisma";

export type AccountProfile = {
  id: string;
  name: string;
  phone?: string | null;
  image?: string | null;
};

export async function getAccountProfile(session: Session): Promise<AccountProfile> {
  const fallback = {
    id: session.user.id,
    name: session.user.name ?? "Аккаунт",
    phone: session.user.phone,
    image: session.user.image
  };

  if (!canUseDatabase()) return fallback;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      phone: true,
      image: true
    }
  });

  return user ?? fallback;
}
