"use server";

import { requireSession } from "@/lib/guards";
import { completeTelegramAccountLink } from "@/lib/telegram-login";

export async function completeTelegramAccountLinkAction(intentToken: string) {
  const session = await requireSession();
  return completeTelegramAccountLink(intentToken, session.user.id);
}
