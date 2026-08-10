"use client";

import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { useState, useTransition } from "react";
import {
  openDepositPaymentCheckoutAction,
  openFinalPaymentCheckoutAction
} from "@/app/dashboard/client/actions";
import { Button } from "@/components/ui/button";

type FinalPaymentButtonProps = {
  bookingNumber: string;
  type?: "deposit" | "final";
  className?: string;
};

export function FinalPaymentButton({
  bookingNumber,
  type = "final",
  className
}: FinalPaymentButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const label =
    type === "deposit" ? "Подтвердить бронь" : "Остаток оплачивается напрямую";

  function openCheckout() {
    setError("");
    startTransition(async () => {
      const result =
        type === "deposit"
          ? await openDepositPaymentCheckoutAction(bookingNumber)
          : await openFinalPaymentCheckoutAction(bookingNumber);

      if (result.success && result.checkoutUrl) {
        router.push(result.checkoutUrl);
        return;
      }

      setError(result.error ?? "Не удалось открыть оплату.");
    });
  }

  return (
    <div className="grid gap-2">
      <Button type="button" disabled={isPending} onClick={openCheckout} className={className}>
        <CreditCard className="size-4" aria-hidden="true" />
        {isPending ? "Открываем оплату..." : label}
      </Button>
      {error ? <p className="text-xs font-medium text-rose-300">{error}</p> : null}
    </div>
  );
}
