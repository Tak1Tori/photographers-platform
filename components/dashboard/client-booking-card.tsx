import Link from "next/link";
import { ArrowRight, RotateCcw, Star } from "lucide-react";
import { FinalPaymentButton } from "@/components/dashboard/final-payment-button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/mock-data";
import type { ClientBookingListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ClientBookingCardProps {
  booking: ClientBookingListItem;
  isHistory?: boolean;
  showMoney?: boolean;
}

export function ClientBookingCard({
  booking,
  isHistory = false,
  showMoney = false
}: ClientBookingCardProps) {
  const detailsHref = `/dashboard/client/bookings/${booking.id}`;
  const canReview = booking.status === "Completed" && !booking.hasReview;
  const canPayFinal =
    !isHistory &&
    booking.paymentStatus === "FINAL_PAYMENT_PENDING" &&
    booking.remainingAmount > 0;
  const canPayDeposit =
    !isHistory &&
    ["UNPAID", "DEPOSIT_PENDING", "FAILED"].includes(booking.paymentStatus) &&
    (booking.platformFeeAmount ?? booking.depositAmount) > booking.paidAmount &&
    booking.platformFeeStatus !== "PAID";
  const totalServicePrice = booking.totalServicePrice ?? booking.totalAmount;
  const platformFeeAmount = booking.platformFeeAmount ?? booking.depositAmount;
  const providerAmount = booking.providerAmount ?? booking.remainingAmount;

  return (
    <article
      className={cn(
        "grid gap-4 rounded-xl border border-border bg-card/80 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.22)] ring-1 ring-emerald-950/40 transition-colors hover:border-primary/35 hover:bg-card",
        showMoney && "lg:grid-cols-[1.4fr_0.9fr_auto] lg:items-center"
      )}
    >
      <div className="grid gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Запись N {booking.id}
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-normal">
              {booking.styleName}
            </h2>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <StatusBadge status={booking.status} />
            {!isHistory ? (
              <>
                <StatusBadge status={booking.paymentStatus} />
                <StatusBadge status={booking.bookingType ?? "FULL_SHOOT"} />
              </>
            ) : null}
          </div>
        </div>

        <div className="grid gap-1 border-t border-border/80 pt-3 text-sm text-muted-foreground">
          <p>
            {booking.date} · {booking.time} · {booking.durationHours} ч
          </p>
          <p>
            {booking.photographerName} · {booking.studioName}
          </p>
          {booking.hallName ? <p>{booking.hallName}</p> : null}
        </div>
      </div>

      {showMoney ? (
        <div className="grid gap-1 rounded-lg border border-border/80 bg-secondary/25 p-3 text-sm">
          <MoneyLine label="Стоимость услуги" value={totalServicePrice} />
          <MoneyLine label="Сервисный сбор" value={platformFeeAmount} />
          <MoneyLine label="Оплачено платформе" value={booking.paidAmount} />
          <MoneyLine label="К оплате исполнителю" value={providerAmount} />
        </div>
      ) : null}

      <div className={cn("grid gap-2 sm:flex sm:flex-wrap", showMoney && "lg:justify-end")}>
        {isHistory ? (
          <>
            {canReview ? (
              <Button
                asChild
                variant="outline"
                className="border-primary/60 text-emerald-200 hover:border-emerald-300"
              >
                <Link href={`${detailsHref}#review`}>
                  <Star className="size-4" aria-hidden="true" />
                  Оценить запись
                </Link>
              </Button>
            ) : (
              <Button type="button" variant="secondary" disabled>
                <Star className="size-4" aria-hidden="true" />
                {booking.hasReview ? "Отзыв оставлен" : "Оценка недоступна"}
              </Button>
            )}
            <Button asChild>
              <Link href={buildRepeatBookingHref(booking)}>
                <RotateCcw className="size-4" aria-hidden="true" />
                Записаться снова
              </Link>
            </Button>
          </>
        ) : null}
        {canPayFinal ? (
          <FinalPaymentButton bookingNumber={booking.id} className="w-full sm:w-auto" />
        ) : null}
        {canPayDeposit ? (
          <FinalPaymentButton
            bookingNumber={booking.id}
            type="deposit"
            className="w-full sm:w-auto"
          />
        ) : null}
        <Button asChild variant={isHistory ? "ghost" : "outline"}>
          <Link href={detailsHref}>
            Подробнее
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

function MoneyLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{formatPrice(value)}</span>
    </div>
  );
}

function buildRepeatBookingHref(booking: ClientBookingListItem) {
  if (booking.photographerId) {
    const params = new URLSearchParams({
      type: "PHOTOGRAPHER_ONLY",
      photographerId: booking.photographerId
    });
    if (booking.photographerId) params.set("photographerId", booking.photographerId);
    return `/booking/new?${params.toString()}`;
  }

  return "/photographers?mode=booking";
}
