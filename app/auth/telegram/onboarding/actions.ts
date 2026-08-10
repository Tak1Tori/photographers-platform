"use server";

import { completeTelegramOnboarding } from "@/lib/telegram-login";

export async function completeTelegramOnboardingAction(input: {
  intentToken: string;
  role: "CLIENT" | "PHOTOGRAPHER";
  acceptedLegal: boolean;
}) {
  return completeTelegramOnboarding(input.intentToken, input.role, input.acceptedLegal);
}
