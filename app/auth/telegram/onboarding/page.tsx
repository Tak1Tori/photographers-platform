import { redirect } from "next/navigation";
import { TelegramOnboardingForm } from "@/components/auth/telegram-onboarding-form";
import { PageHeader } from "@/components/shared/page-header";
import { getTelegramOnboardingIntent } from "@/lib/telegram-login";

export const dynamic = "force-dynamic";

export default async function TelegramOnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const { intent } = await searchParams;
  const onboardingIntent = intent ? await getTelegramOnboardingIntent(intent) : null;

  if (!intent || !onboardingIntent) {
    redirect("/auth/sign-in?error=TelegramOnboardingExpired");
  }

  return (
    <>
      <PageHeader
        eyebrow="Telegram"
        title="Создать аккаунт"
        description="Проверьте данные и выберите роль для работы с Framely."
        centered
      />
      <section className="section">
        <div className="container">
          <TelegramOnboardingForm
            intentToken={intent}
            name={onboardingIntent.displayName}
            phone={formatPhone(onboardingIntent.phone)}
          />
        </div>
      </section>
    </>
  );
}

function formatPhone(phone: string) {
  if (phone.length === 12 && phone.startsWith("+7")) {
    return `+7 ${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8, 10)} ${phone.slice(10)}`;
  }

  return phone;
}
