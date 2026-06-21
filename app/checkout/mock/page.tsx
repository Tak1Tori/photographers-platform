import { CreditCard, ShieldCheck } from "lucide-react";
import { cancelMockPaymentAction, confirmMockPaymentAction } from "@/app/checkout/mock/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBookingById } from "@/lib/data/bookings";
import { canUseDatabase } from "@/lib/data/db";
import { getSession } from "@/lib/auth";
import { formatPrice } from "@/lib/mock-data";
import { getPaymentById } from "@/lib/payments/payment-service";

interface MockCheckoutPageProps {
  searchParams: {
    paymentId?: string;
    cancelled?: string;
    error?: string;
  };
}

export default async function MockCheckoutPage({ searchParams }: MockCheckoutPageProps) {
  const paymentId = searchParams.paymentId;
  const payment = paymentId && canUseDatabase() ? await getPaymentById(paymentId) : undefined;
  const session = payment ? await getSession() : undefined;
  const mockBooking = !canUseDatabase() && paymentId ? await getBookingById(paymentId) : undefined;
  const canAccessPayment =
    !payment ||
    session?.user.role === "ADMIN" ||
    (session?.user.id && payment.booking.clientId === session.user.id);

  if (!paymentId || (!payment && !mockBooking) || !canAccessPayment) {
    return (
      <>
        <PageHeader eyebrow="Checkout" title="Платеж не найден" description="Проверьте ссылку на оплату или создайте бронь заново." />
        <section className="section"><div className="container"><EmptyBox text="Payment не найден." /></div></section>
      </>
    );
  }

  if (searchParams.cancelled) {
    return (
      <>
        <PageHeader eyebrow="Checkout" title="Оплата отменена" description="Депозит не был списан. Можно вернуться к бронированию и попробовать снова." />
        <section className="section"><div className="container"><EmptyBox text="Оплата отменена." /></div></section>
      </>
    );
  }

  if (searchParams.error) {
    return (
      <>
        <PageHeader eyebrow="Checkout" title="Платеж не обработан" description="Webhook не подтвердил оплату. Статус брони не изменен." />
        <section className="section"><div className="container"><EmptyBox text="Проверьте платеж и попробуйте снова." /></div></section>
      </>
    );
  }

  const booking = payment?.booking;
  const details = booking
    ? {
        bookingNumber: booking.bookingNumber,
        bookingType: booking.bookingType,
        style: booking.style?.name ?? booking.shootType ?? "Бронирование фотографа",
        photographer: booking.photographer?.name ?? "Без фотографа",
        studio: booking.studio?.name ?? "Без студии",
        hall: booking.studioHall?.name ?? "Без зала",
        shootType: booking.shootType,
        rentalPurpose: booking.rentalPurpose,
        date: booking.date.toISOString().slice(0, 10),
        time: booking.startTime,
        durationHours: booking.durationHours,
        total: booking.totalPrice,
        deposit: booking.depositAmount,
        remaining: Math.max(booking.totalPrice - booking.depositAmount, 0)
      }
    : mockBooking
      ? {
          bookingNumber: mockBooking.id,
          bookingType: mockBooking.bookingType,
          style: mockBooking.styleId,
          photographer: mockBooking.photographerId,
          studio: mockBooking.studioId,
          hall: mockBooking.hallName,
          shootType: mockBooking.shootType,
          rentalPurpose: mockBooking.rentalPurpose,
          date: mockBooking.date,
          time: mockBooking.time,
          durationHours: mockBooking.durationHours,
          total: mockBooking.totalAmount,
          deposit: mockBooking.depositAmount,
          remaining: Math.max(mockBooking.totalAmount - mockBooking.depositAmount, 0)
        }
      : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Mock checkout"
        title={
          payment?.type === "FINAL_PAYMENT"
            ? "Оплата остатка"
            : details?.bookingType === "PHOTOGRAPHER_ONLY"
            ? "Оплата депозита за бронирование фотографа"
            : details?.bookingType === "STUDIO_ONLY"
              ? "Оплата депозита за аренду студии"
              : "Оплата депозита"
        }
        description="Тестовый hosted checkout. Статус оплаты меняется только после подписанного mock webhook."
      />
      <section className="section">
        <div className="container grid gap-6 lg:grid-cols-[1fr_420px]">
          <Card>
            <CardHeader>
              <CardTitle>Детали брони</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2">
              <Summary label="Номер брони" value={details?.bookingNumber ?? "-"} />
              {details?.bookingType === "STUDIO_ONLY" ? (
                <>
                  <Summary label="Студия" value={details?.studio ?? "-"} />
                  <Summary label="Зал" value={details?.hall ?? "-"} />
                  <Summary label="Цель аренды" value={details?.rentalPurpose ?? "-"} />
                </>
              ) : (
                <>
                  <Summary label={details?.bookingType === "PHOTOGRAPHER_ONLY" ? "Тип съемки" : "Стиль"} value={details?.style ?? "-"} />
                  <Summary label="Фотограф" value={details?.photographer ?? "-"} />
                </>
              )}
              <Summary label="Дата и время" value={`${details?.date ?? "-"} · ${details?.time ?? "-"}`} />
              <Summary label="Длительность" value={`${details?.durationHours ?? "-"} ч`} />
              <Summary label="Общая стоимость" value={formatPrice(details?.total ?? 0)} />
              <Summary label="Депозит" value={formatPrice(details?.deposit ?? 0)} />
              <Summary label="Остаток" value={formatPrice(details?.remaining ?? 0)} />
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
                Списание не происходит, статус меняется в БД.
              </p>
              <form action={confirmMockPaymentAction}>
                <input type="hidden" name="paymentId" value={paymentId} />
                <Button className="w-full" size="lg">
                  {payment?.type === "FINAL_PAYMENT" ? "Оплатить остаток" : "Оплатить депозит"}
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
    </>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
