import type { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export async function requireSession(allowedRoles?: UserRole[]) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  if (allowedRoles?.length && !allowedRoles.includes(session.user.role)) {
    redirect("/unauthorized");
  }

  return session;
}
