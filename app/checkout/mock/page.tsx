import { CreditCard, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { cancelMockPaymentAction, confirmMockPaymentAction } from "@/app/checkout/mock/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBookingById } from "@/lib/data/bookings";
import { canUseDatabase } from "@/lib/data/db";
import { getSession } from "@/lib/auth";
import { formatPrice } from "@/lib/mock-data";
import { getPaymentById } from "@/lib/payments/payment-service";

interface MockCheckoutPageProps {
  searchParams: Promise<{
    paymentId?: string;
    cancelled?: string;
    error?: string;
  }>;
}

export default async function MockCheckoutPage({ searchParams }: MockCheckoutPageProps) {
  const resolvedSearchParams = await searchParams;
  const paymentId = resolvedSearchParams.paymentId;
  const payment = paymentId && canUseDatabase() ? await getPaymentById(paymentId) : undefined;
  const session = payment ? await getSession() : undefined;
  const mockBooking = !canUseDatabase() && paymentId ? await getBookingById(paymentId) : undefined;
  const canAccessPayment =
    !payment ||
    payment.booking.source === "TELEGRAM_LEAD" ||
    session?.user.role === "ADMIN" ||
    (session?.user.id && payment.booking.clientId === session.user.id);

  if (!paymentId || (!payment && !mockBooking) || !canAccessPayment) {
    return (
      <section className="py-6 md:py-10"><div className="container"><EmptyBox text="Payment не найден." /></div></section>
    );
  }

  if (resolvedSearchParams.cancelled) {
    return (
      <section className="py-6 md:py-10"><div className="container"><EmptyBox text="Оплата отменена." /></div></section>
    );
  }

  if (resolvedSearchParams.error) {
    return (
      <section className="py-6 md:py-10"><div className="container"><EmptyBox text="Проверьте платеж и попробуйте снова." /></div></section>
    );
  }

  const booking = payment?.booking;
  const isPlatformFeePayment =
    payment?.type === "PLATFORM_FEE" || payment?.type === "DEPOSIT" || !payment?.type;
  const details = booking
    ? {
        bookingNumber: booking.bookingNumber,
        bookingType: booking.bookingType,
        style: booking.style?.name ?? booking.shootType ?? "Бронирование фотографа",
        serviceTitle: booking.photographerServiceTitle,
        serviceDurationMinutes: booking.photographerServiceDurationMinutes,
        photographer: booking.photographer?.name ?? "Без фотографа",
        shootType: booking.shootType,
        rentalPurpose: booking.rentalPurpose,
        date: booking.date.toISOString().slice(0, 10),
        time: booking.startTime,
        durationHours: booking.durationHours,
        total: booking.totalServicePrice || booking.totalPrice,
        platformFee: booking.platformFeeAmount || booking.depositAmount || payment?.amount || booking.serviceFee,
        providerAmount:
          booking.providerAmount ||
          booking.remainingAmount ||
          Math.max((booking.totalServicePrice || booking.totalPrice) - (booking.platformFeeAmount || booking.depositAmount || booking.serviceFee), 0)
      }
    : mockBooking
      ? {
          bookingNumber: mockBooking.id,
          bookingType: mockBooking.bookingType,
          style: mockBooking.styleId,
          serviceTitle: mockBooking.photographerServiceTitle,
          serviceDurationMinutes: mockBooking.photographerServiceDurationMinutes,
          photographer: mockBooking.photographerId,
          shootType: mockBooking.shootType,
          rentalPurpose: mockBooking.rentalPurpose,
          date: mockBooking.date,
          time: mockBooking.time,
          durationHours: mockBooking.durationHours,
          total: mockBooking.totalServicePrice ?? mockBooking.totalAmount,
          platformFee: mockBooking.platformFeeAmount ?? mockBooking.depositAmount,
          providerAmount:
            mockBooking.providerAmount ??
            Math.max((mockBooking.totalServicePrice ?? mockBooking.totalAmount) - (mockBooking.platformFeeAmount ?? mockBooking.depositAmount), 0)
        }
      : undefined;

  return (
      <section className="py-6 md:py-10">
        <div className="container grid gap-6 lg:grid-cols-[1fr_420px]">
          <Card>
            <CardHeader>
              <CardTitle>Детали брони</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <Summary label="Номер брони" value={details?.bookingNumber ?? "-"} />
              <Summary label={details?.bookingType === "PHOTOGRAPHER_ONLY" ? "Тип съемки" : "Формат"} value={details?.style ?? "-"} />
              {details?.serviceTitle ? <Summary label="Выбранная услуга" value={details.serviceTitle} /> : null}
              <Summary label="Фотограф" value={details?.photographer ?? "-"} />
              <Summary label="Дата и время" value={`${details?.date ?? "-"} · ${details?.time ?? "-"}`} />
              <Summary label="Длительность" value={formatBookingDuration(details?.serviceDurationMinutes, details?.durationHours)} />
              <Summary label="Стоимость услуги" value={formatPrice(details?.total ?? 0)} />
              <Summary label="Сервисный сбор платформы" value={formatPrice(details?.platformFee ?? 0)} />
              <Summary label="Остаток исполнителю" value={formatPrice(details?.providerAmount ?? 0)} />
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="size-5" aria-hidden="true" />
                Mock payment card
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="rounded-lg bg-primary p-5 text-primary-foreground">
                <p className="text-sm opacity-80">Framely test card</p>
                <p className="mt-8 font-mono text-lg">4242 4242 4242 4242</p>
                <div className="mt-5 flex justify-between text-xs opacity-80">
                  <span>12/30</span>
                  <span>123</span>
                </div>
              </div>
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Списание не происходит. Сервисный сбор подтверждает бронь, остаток оплачивается напрямую исполнителю.
              </p>
              <form action={confirmMockPaymentAction}>
                <input type="hidden" name="paymentId" value={paymentId} />
                <label className="mb-4 flex cursor-pointer items-start gap-3 text-xs leading-5 text-muted-foreground">
                  <input name="acceptedLegal" type="checkbox" required className="mt-0.5 size-4 shrink-0 accent-primary" />
                  <span>
                    Я принимаю <Link href="/offer" className="text-foreground underline underline-offset-2">Публичную оферту</Link> и <Link href="/payment-and-refund" className="text-foreground underline underline-offset-2">Правила оплаты и возврата</Link>.
                  </span>
                </label>
                <Button className="w-full" size="lg">
                  {isPlatformFeePayment
                    ? `Подтвердить бронь за ${formatPrice(details?.platformFee ?? payment?.amount ?? 0)}`
                    : "Продолжить"}
                </Button>
              </form>
              <form action={cancelMockPaymentAction}>
                <input type="hidden" name="paymentId" value={paymentId} />
                <Button className="w-full" variant="outline">Отменить оплату</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
  );
}

function formatBookingDuration(durationMinutes?: number | null, durationHours?: number) {
  if (durationMinutes) {
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    return hours > 0 ? `${hours} ч${minutes ? ` ${minutes} мин` : ""}` : `${minutes} мин`;
  }
  return `${durationHours ?? "-"} ч`;
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border p-3 sm:p-4">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-semibold">{value}</p>
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
