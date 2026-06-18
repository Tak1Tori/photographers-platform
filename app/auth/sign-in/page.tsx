import { SignInForm } from "@/components/auth/sign-in-form";
import { PageHeader } from "@/components/shared/page-header";

export default function SignInPage() {
  return (
    <>
      <PageHeader
        eyebrow="Auth"
        title="Войти в аккаунт"
        description="Используйте email и пароль, чтобы открыть свой кабинет."
      />
      <section className="section">
        <div className="container">
          <SignInForm />
        </div>
      </section>
    </>
  );
}
