import { Suspense } from "react";
import { AdminAccessForm } from "@/components/auth/admin-access-form";
import { PageHeader } from "@/components/shared/page-header";

export default function AdminAccessPage() {
  return (
    <>
      <PageHeader title="Административная панель" description="Введите пароль администратора для продолжения." />
      <section className="section">
        <div className="container">
          <Suspense fallback={<div className="mx-auto h-56 w-full max-w-md animate-pulse rounded-md bg-muted" />}>
            <AdminAccessForm />
          </Suspense>
        </div>
      </section>
    </>
  );
}
