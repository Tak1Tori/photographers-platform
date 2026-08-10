import { Suspense } from "react";
import { SignInForm } from "@/components/auth/sign-in-form";
import { PageHeader } from "@/components/shared/page-header";
import { isTelegramLoginEnabled } from "@/lib/telegram-login";

export default function SignInPage() {
  return (
    <>
      <PageHeader title="Войти в аккаунт" />
      <section className="section">
        <div className="container">
          <Suspense fallback={<SignInFormPlaceholder />}>
            <SignInForm telegramEnabled={isTelegramLoginEnabled()} />
          </Suspense>
        </div>
      </section>
    </>
  );
}

function SignInFormPlaceholder() {
  return <div className="mx-auto h-[420px] max-w-xl animate-pulse rounded-md bg-muted" />;
}
