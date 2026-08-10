"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Star, X } from "lucide-react";
import {
  cancelClientBookingAction,
  createClientReviewAction,
  openDepositPaymentCheckoutAction,
  openFinalPaymentCheckoutAction,
  requestBookingRescheduleAction
} from "@/app/dashboard/client/actions";
import { SmartSlotPicker } from "@/components/booking/smart-slot-picker";
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
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleStep, setRescheduleStep] = useState<1 | 2>(1);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [isPending, startTransition] = useTransition();
  const canCancel = ["Pending", "Confirmed"].includes(booking.status);
  const canRequestReschedule = canCancel && !booking.rescheduleRequestedAt;
  const canReview = booking.status === "Completed" && !booking.review;
  const canPayFinal = false;
  const canPayDeposit =
    ["UNPAID", "DEPOSIT_PENDING", "FAILED"].includes(booking.paymentStatus) &&
    (booking.platformFeeAmount ?? booking.depositAmount) > booking.paidAmount &&
    booking.platformFeeStatus !== "PAID" &&
    !["Completed", "Cancelled", "Declined"].includes(booking.status);

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

  function openDepositPayment() {
    if (!canPayDeposit) return;
    startTransition(async () => {
      const result = await openDepositPaymentCheckoutAction(booking.id);
      if (result.success && result.checkoutUrl) {
        router.push(result.checkoutUrl);
        return;
      }
      setState({ error: result.error ?? "Не удалось открыть оплату сервисного сбора." });
    });
  }

  function cancelBooking() {
    if (!canCancel) return;
    const confirmed = window.confirm(
      "Отменить бронь?"
    );

    if (!confirmed) return;

    startTransition(async () => {
      const result = await cancelClientBookingAction(booking.id);
      setState({
        success: result.success ? result.message : undefined,
        error: result.success ? undefined : result.error
      });
      if (result.success) {
        setIsReviewModalOpen(false);
        router.refresh();
      }
    });
  }

  function requestReschedule() {
    if (!canRequestReschedule) return;

    startTransition(async () => {
      const result = await requestBookingRescheduleAction(
        booking.id,
        rescheduleDate,
        rescheduleTime,
        rescheduleComment
      );
      setState({
        success: result.success ? result.message : undefined,
        error: result.success ? undefined : result.error
      });
      if (result.success) {
        setRescheduleComment("");
        setRescheduleDate("");
        setRescheduleTime("");
        setRescheduleStep(1);
        setIsRescheduleModalOpen(false);
        router.refresh();
      }
    });
  }

  function submitReview(formData: FormData) {
    startTransition(async () => {
      const result = await createClientReviewAction(formData);
      setState({
        success: result.success ? result.message : undefined,
        error: result.success ? undefined : result.error
      });
      if (result.success) {
        setIsReviewModalOpen(false);
        router.refresh();
      }
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
            <h3 className="font-semibold tracking-normal">Оплата исполнителю</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Остаток по услуге оплачивается напрямую исполнителю.
            </p>
          </div>
          <Button disabled={isPending} onClick={openFinalPayment}>
            Открыть оплату
          </Button>
        </div>
      ) : null}

      {canPayDeposit ? (
        <div className="grid gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <div>
            <h3 className="font-semibold tracking-normal">Сервисный сбор</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Бронь создана, но сервисный сбор ещё не внесён. Оплатите сбор, чтобы подтвердить заявку.
            </p>
          </div>
          <Button disabled={isPending} onClick={openDepositPayment}>
            Подтвердить бронь
          </Button>
        </div>
      ) : null}

      {booking.platformFeeStatus === "PAID" || booking.paymentStatus === "FULLY_PAID" ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">
          Сервисный сбор оплачен. Оставшаяся сумма оплачивается напрямую исполнителю.
        </p>
      ) : null}

      <div className="grid gap-3 rounded-lg border border-border p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-semibold tracking-normal">Отмена брони</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Доступно только для ожидающих и подтвержденных броней.
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

      {booking.rescheduleRequestedAt ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <p className="font-medium">Запрос на перенос отправлен</p>
          {booking.rescheduleComment ? <p className="mt-1">{booking.rescheduleComment}</p> : null}
        </div>
      ) : canRequestReschedule ? (
        <div className="grid gap-3 rounded-lg border border-border p-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-semibold tracking-normal">Запросить перенос</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Выберите новую дату, время и добавьте комментарий для исполнителя.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setIsRescheduleModalOpen(true)}
            >
              Запросить перенос
            </Button>
          </div>
        </div>
      ) : null}

      {canReview ? (
        <div id="review" className="grid gap-3 rounded-lg border border-border p-4">
          <div>
            <h3 className="font-semibold tracking-normal">Оставить отзыв</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Отзыв доступен после завершенной съемки.
            </p>
          </div>
          <Button
            type="button"
            className="w-full sm:w-fit"
            disabled={isPending}
            onClick={() => setIsReviewModalOpen(true)}
          >
            <Star className="size-4" aria-hidden="true" />
            Оценить запись
          </Button>
        </div>
      ) : null}
      {booking.review ? (
        <p className="rounded-md bg-secondary px-4 py-3 text-sm font-medium">
          Отзыв уже оставлен: {booking.review.rating}/5
        </p>
      ) : null}

      {isReviewModalOpen ? (
        <ReviewModal
          booking={booking}
          isPending={isPending}
          rating={reviewRating}
          onRatingChange={setReviewRating}
          onClose={() => setIsReviewModalOpen(false)}
          onSubmit={submitReview}
        />
      ) : null}
      {isRescheduleModalOpen ? (
        <RescheduleModal
          booking={booking}
          isPending={isPending}
          step={rescheduleStep}
          date={rescheduleDate}
          time={rescheduleTime}
          comment={rescheduleComment}
          onDateChange={setRescheduleDate}
          onTimeChange={setRescheduleTime}
          onCommentChange={setRescheduleComment}
          onStepChange={setRescheduleStep}
          onClose={() => setIsRescheduleModalOpen(false)}
          onSubmit={requestReschedule}
        />
      ) : null}
    </div>
  );
}

function RescheduleModal({
  booking,
  isPending,
  step,
  date,
  time,
  comment,
  onDateChange,
  onTimeChange,
  onCommentChange,
  onStepChange,
  onClose,
  onSubmit
}: {
  booking: ClientBookingDetails;
  isPending: boolean;
  step: 1 | 2;
  date: string;
  time: string;
  comment: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onCommentChange: (value: string) => void;
  onStepChange: (step: 1 | 2) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reschedule-modal-title"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-lg border border-border bg-card p-4 shadow-2xl sm:p-5"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="reschedule-modal-title" className="text-xl font-semibold tracking-normal">
              Запросить перенос
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Шаг {step} из 2
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border p-2 text-muted-foreground transition hover:text-foreground"
            aria-label="Закрыть"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          {step === 1 ? (
            <>
              <SmartSlotPicker
                bookingType={booking.bookingType}
                photographerId={booking.photographerId || undefined}
                studioHallId={booking.studioId || undefined}
                durationHours={booking.durationHours}
                presentation="split"
                onSelectionChange={(nextDate, nextTime) => {
                  onDateChange(nextDate);
                  onTimeChange(nextTime);
                }}
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={onClose}>
                  Отмена
                </Button>
                <Button type="button" disabled={!date || !time} onClick={() => onStepChange(2)}>
                  Далее
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-md border border-border bg-secondary/30 p-3 text-sm">
                <p className="text-muted-foreground">Новое время</p>
                <p className="mt-1 font-medium">{date} · {time}</p>
              </div>
              <label className="grid gap-2 text-sm font-medium">
                Комментарий для исполнителя
                <textarea
                  value={comment}
                  onChange={(event) => onCommentChange(event.target.value)}
                  className="min-h-24 rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Почему переносим и какие окна подойдут?"
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" onClick={() => onStepChange(1)}>
                  Назад
                </Button>
                <Button type="button" disabled={isPending || !date || !time} onClick={onSubmit}>
                  Отправить запрос
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewModal({
  booking,
  isPending,
  rating,
  onRatingChange,
  onClose,
  onSubmit
}: {
  booking: ClientBookingDetails;
  isPending: boolean;
  rating: number;
  onRatingChange: (rating: number) => void;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  const reviewPhotographer = booking.bookingType !== "STUDIO_ONLY";
  const reviewStudio = booking.bookingType !== "PHOTOGRAPHER_ONLY";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
      onMouseDown={onClose}
    >
      <form
        action={onSubmit}
        className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input type="hidden" name="bookingNumber" value={booking.id} />
        <input type="hidden" name="rating" value={rating} />
        {reviewPhotographer ? <input type="hidden" name="reviewPhotographer" value="on" /> : null}
        {reviewStudio ? <input type="hidden" name="reviewStudio" value="on" /> : null}

        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="review-modal-title" className="text-xl font-semibold tracking-normal">
              Оценить запись
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Поставьте оценку и оставьте короткий комментарий.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border p-2 text-muted-foreground transition hover:text-foreground"
            aria-label="Закрыть"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="grid gap-2">
            <span className="text-sm font-medium">Оценка</span>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => onRatingChange(star)}
                  className="rounded-md border border-border bg-background p-2 transition hover:border-emerald-300"
                  aria-label={`${star} из 5`}
                >
                  <Star
                    className={
                      star <= rating
                        ? "size-6 fill-emerald-300 text-emerald-300"
                        : "size-6 text-muted-foreground"
                    }
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </div>

          <label className="grid gap-2 text-sm font-medium">
            Комментарий
            <textarea
              name="comment"
              className="min-h-28 rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Что понравилось в съемке?"
            />
          </label>

          <Button disabled={isPending} className="w-full">
            Сохранить отзыв
          </Button>
        </div>
      </form>
    </div>
  );
}
