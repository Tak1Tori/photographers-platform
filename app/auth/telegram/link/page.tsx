import { redirect } from "next/navigation";
import { TelegramAccountLinkForm } from "@/components/auth/telegram-account-link-form";
import { PageHeader } from "@/components/shared/page-header";
import { getDashboardHref } from "@/lib/auth";
import { requireSession } from "@/lib/guards";
import { getPendingTelegramAccountLinkIntent } from "@/lib/telegram-login";

export const dynamic = "force-dynamic";

export default async function TelegramAccountLinkPage({
  searchParams
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const session = await requireSession();
  const { intent } = await searchParams;
  const linkIntent = intent
    ? await getPendingTelegramAccountLinkIntent(intent, session.user.id)
    : null;

  if (!intent || !linkIntent) {
    redirect("/auth/sign-in?error=TelegramLinkExpired");
  }

  return (
    <>
      <PageHeader
        eyebrow="Telegram"
        title="Связать Telegram"
        description="Подтвердите привязку Telegram к вашему аккаунту Framely."
        centered
      />
      <section className="section">
        <div className="container">
          <TelegramAccountLinkForm
            intentToken={intent}
            phone={formatPhone(linkIntent.phone)}
            redirectTo={getDashboardHref(session.user.role)}
          />
        </div>
      </section>
    </>
  );
}

function formatPhone(phone: string) {
  return phone.length === 12 && phone.startsWith("+7")
    ? `+7 ${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8, 10)} ${phone.slice(10)}`
    : phone;
}
