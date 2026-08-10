import type { Metadata } from "next";
import { Mail, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Контакты | Framely",
  description: "Контакты службы поддержки Framely."
};

export default function ContactsPage() {
  return (
    <section className="py-10 md:py-16">
      <div className="container">
        <div className="mx-auto grid max-w-2xl gap-8 text-center">
          <div>
            <p className="text-sm font-medium text-primary">КОНТАКТЫ</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal md:text-4xl">Свяжитесь с Framely</h1>
            <p className="mt-4 text-sm leading-6 text-muted-foreground md:text-base">
              Напишите нам в поддержку или позвоните по вопросам сотрудничества.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="grid min-h-44 place-items-center gap-3 px-6 py-7">
                <Mail className="size-6 text-primary" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Поддержка</p>
                <a
                  className="break-all text-base font-semibold text-foreground transition-colors hover:text-primary"
                  href="mailto:fr4melysupport@gmail.com"
                >
                  fr4melysupport@gmail.com
                </a>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="grid min-h-44 place-items-center gap-3 px-6 py-7">
                <Phone className="size-6 text-primary" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Сотрудничество</p>
                <a
                  className="text-base font-semibold text-foreground transition-colors hover:text-primary"
                  href="tel:+77019717702"
                >
                  8 701 971 77 02
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
