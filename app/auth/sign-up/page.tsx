import { SignUpForm } from "@/components/auth/sign-up-form";
import { PageHeader } from "@/components/shared/page-header";

export default function SignUpPage() {
  return (
    <>
      <PageHeader
        eyebrow="Auth"
        title="Создать аккаунт"
        description="Выберите роль, чтобы получить доступ к нужному кабинету."
      />
      <section className="section">
        <div className="container">
          <SignUpForm />
        </div>
      </section>
    </>
  );
}
