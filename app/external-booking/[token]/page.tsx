import { Clock, CreditCard, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { submitExternalBookingLeadAction } from "@/lib/booking-leads/booking-lead-actions";
import { calculateBookingLeadPricing } from "@/lib/booking-leads/booking-lead-pricing";
import { getBookingLeadByPublicToken } from "@/lib/booking-leads/booking-lead-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/mock-data";
import { BookingLeadStatus } from "@prisma/client";

interface ExternalBookingPageProps {
  params: { token: string };
}

export default async function ExternalBookingPage({ params }: ExternalBookingPageProps) {
  const lead = await getBookingLeadByPublicToken(params.token);
  const isActive =
    lead &&
    lead.publicLinkExpiresAt &&
    lead.publicLinkExpiresAt > new Date() &&
    (lead.status === BookingLeadStatus.LINK_CREATED ||
      lead.status === BookingLeadStatus.LINK_SENT);

  if (!lead || !isActive) {
    return (
      <section className="section">
        <div className="container max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>Ссылка на бронь недоступна</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Срок ссылки истек или заявка уже обработана. Попросите фотографа отправить новую ссылку.
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  if (lead.bookingType !== "PHOTOGRAPHER_ONLY") {
    redirect("/photographers?mode=booking");
  }

  const pricing = calculateBookingLeadPricing(lead);
  const providerName = lead.photographerProfile?.name ?? "Фотограф";

  return (
    <section className="section">
      <div className="container grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-primary">Внешняя заявка</p>
            <h1 className="mt-3 text-4xl font-semibold text-foreground md:text-6xl">
              Подтвердите бронь
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Проверьте детали, оставьте контакты и оплатите сервисный сбор в mock checkout.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-5" aria-hidden="true" />
                Детали
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm md:grid-cols-2">
              <Summary label="Исполнитель" value={providerName} />
              <Summary label="Формат" value="Фотограф" />
              <Summary label="Дата" value={lead.parsedStartTime ? formatDate(lead.parsedStartTime) : "-"} />
              <Summary
                label="Время"
                value={
                  lead.parsedStartTime && lead.parsedEndTime
                    ? `${formatTime(lead.parsedStartTime)}-${formatTime(lead.parsedEndTime)}`
                    : "-"
                }
              />
              <Summary label="Описание" value={lead.title ?? "Внешняя заявка"} />
              <Summary label="Ссылка активна до" value={lead.publicLinkExpiresAt ? formatDateTime(lead.publicLinkExpiresAt) : "-"} />
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-5" aria-hidden="true" />
              Сервисный сбор
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2 rounded-lg border border-border p-4 text-sm">
              <PriceLine label="Стоимость" value={pricing.photographerTotal + pricing.studioTotal} />
              <PriceLine label="Сервисный сбор платформы" value={pricing.platformFeeAmount} />
              <PriceLine label="Стоимость услуги" value={pricing.totalServicePrice} strong />
              <PriceLine label="К оплате исполнителю" value={pricing.providerAmount} />
              <PriceLine label="К оплате сейчас" value={pricing.platformFeeAmount} accent />
            </div>

            <form action={submitExternalBookingLeadAction} className="space-y-4">
              <input type="hidden" name="token" value={params.token} />
              <Field name="clientName" label="Имя" defaultValue={lead.clientName ?? ""} required />
              <Field name="clientPhone" label="Телефон" defaultValue={lead.clientPhone ?? ""} required />
              <label className="block text-sm font-medium text-foreground">
                Комментарий
                <textarea
                  name="clientComment"
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none transition focus:border-primary"
                  placeholder="Необязательно"
                />
              </label>
              <Button size="lg" className="w-full">
                <UserRound className="mr-2 size-5" aria-hidden="true" />
                Подтвердить бронь
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}

function PriceLine({
  label,
  value,
  strong,
  accent
}: {
  label: string;
  value: number;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${strong ? "text-base font-semibold" : ""} ${accent ? "text-primary" : ""}`}>
      <span>{label}</span>
      <span>{formatPrice(value)}</span>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  required,
  type = "text"
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium text-foreground">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="mt-2 w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none transition focus:border-primary"
      />
    </label>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function formatDateTime(date: Date) {
  return `${formatDate(date)} ${formatTime(date)}`;
}
