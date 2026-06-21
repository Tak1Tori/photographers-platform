"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  cancelClientBookingAction,
  createClientReviewAction,
  openFinalPaymentCheckoutAction,
  requestBookingRescheduleAction
} from "@/app/dashboard/client/actions";
import { Button } from "@/components/ui/button";
import type { ClientBookingDetails } from "@/lib/types";

type ActionState = {
  success?: string;
  error?: string;
};

export function ClientBookingActions({ booking }: { booking: ClientBookingDetails }) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>({});
  const [rescheduleComment, setRescheduleComment] = useState("");
  const [isPending, startTransition] = useTransition();
  const canCancel = ["Pending", "Confirmed"].includes(booking.status);
  const canReview = booking.status === "Completed" && !booking.review;
  const canPayFinal =
    booking.paymentStatus === "FINAL_PAYMENT_PENDING" &&
    booking.remainingAmount > 0;

  function openFinalPayment() {
    if (!canPayFinal) return;
    startTransition(async () => {
      const result = await openFinalPaymentCheckoutAction(booking.id);
      if (result.success && result.checkoutUrl) {
        router.push(result.checkoutUrl);
        return;
      }
      setState({ error: result.error ?? "Не удалось открыть оплату." });
    });
  }

  function cancelBooking() {
    if (!canCancel) return;
    const confirmed = window.confirm(
      "Отменить бронь? Возврат депозита будет обрабатываться администратором вручную."
    );

    if (!confirmed) return;

    startTransition(async () => {
      const result = await cancelClientBookingAction(booking.id);
      setState({
        success: result.success ? result.message : undefined,
        error: result.success ? undefined : result.error
      });
    });
  }

  function requestReschedule() {
    startTransition(async () => {
      const result = await requestBookingRescheduleAction(booking.id, rescheduleComment);
      setState({
        success: result.success ? result.message : undefined,
        error: result.success ? undefined : result.error
      });
      if (result.success) setRescheduleComment("");
    });
  }

  function submitReview(formData: FormData) {
    startTransition(async () => {
      const result = await createClientReviewAction(formData);
      setState({
        success: result.success ? result.message : undefined,
        error: result.success ? undefined : result.error
      });
    });
  }

  return (
    <div className="grid gap-5">
      {state.success ? (
        <p className="rounded-md bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-800">
          {state.success}
        </p>
      ) : null}
      {state.error ? (
        <p className="rounded-md bg-rose-100 px-4 py-3 text-sm font-medium text-rose-800">
          {state.error}
        </p>
      ) : null}

      {canPayFinal ? (
        <div className="grid gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div>
            <h3 className="font-semibold tracking-normal">Финальная оплата</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Исполнитель завершил работу. Оплатите остаток через защищённую страницу провайдера.
            </p>
          </div>
          <Button disabled={isPending} onClick={openFinalPayment}>
            Оплатить остаток
          </Button>
        </div>
      ) : null}

      {booking.paymentStatus === "FULLY_PAID" ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">
          Полностью оплачено
        </p>
      ) : null}

      {booking.paymentStatus !== "FULLY_PAID" ? (
        <p className="rounded-md bg-secondary px-4 py-3 text-sm text-muted-foreground">
          Финальные материалы передаются после полной оплаты через платформу.
        </p>
      ) : null}

      <div className="grid gap-3 rounded-lg border border-border p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-semibold tracking-normal">Отмена брони</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Доступно только для Pending и Confirmed. Возврат депозита обрабатывается
              администратором вручную.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!canCancel || isPending}
            onClick={cancelBooking}
          >
            Отменить бронь
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-border p-4">
        <div>
          <h3 className="font-semibold tracking-normal">Запросить перенос</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Мы сохраним комментарий, а полноценный календарь переноса появится позже.
          </p>
        </div>
        <textarea
          value={rescheduleComment}
          onChange={(event) => setRescheduleComment(event.target.value)}
          className="min-h-24 rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder="Например: хочу перенести на следующую субботу после 14:00"
        />
        <Button
          type="button"
          disabled={isPending || !rescheduleComment.trim()}
          onClick={requestReschedule}
        >
          Запросить перенос
        </Button>
      </div>

      {booking.rescheduleRequestedAt ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <p className="font-medium">Запрос на перенос отправлен</p>
          {booking.rescheduleComment ? <p className="mt-1">{booking.rescheduleComment}</p> : null}
        </div>
      ) : null}

      {canReview ? (
        <form action={submitReview} className="grid gap-3 rounded-lg border border-border p-4">
          <input type="hidden" name="bookingNumber" value={booking.id} />
          <div>
            <h3 className="font-semibold tracking-normal">Оставить отзыв</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Отзыв доступен после завершенной съемки.
            </p>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            Рейтинг
            <select
              name="rating"
              defaultValue="5"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {[5, 4, 3, 2, 1].map((rating) => (
                <option key={rating} value={rating}>{rating}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Комментарий
            <textarea
              name="comment"
              className="min-h-24 rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Что понравилось в съемке?"
            />
          </label>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input name="reviewPhotographer" type="checkbox" defaultChecked />
              отзыв фотографу
            </label>
            <label className="inline-flex items-center gap-2">
              <input name="reviewStudio" type="checkbox" defaultChecked />
              отзыв студии
            </label>
          </div>
          <Button disabled={isPending}>Сохранить отзыв</Button>
        </form>
      ) : null}
      {booking.review ? (
        <p className="rounded-md bg-secondary px-4 py-3 text-sm font-medium">
          Отзыв уже оставлен: {booking.review.rating}/5
        </p>
      ) : null}
    </div>
  );
}
