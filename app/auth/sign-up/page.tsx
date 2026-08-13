import { SignUpForm } from "@/components/auth/sign-up-form";
import { PageHeader } from "@/components/shared/page-header";

export default function SignUpPage() {
  return (
    <>
      <PageHeader title="Создать аккаунт" />
      <section className="section">
        <div className="container">
          <SignUpForm />
        </div>
      </section>
    </>
  );
}
