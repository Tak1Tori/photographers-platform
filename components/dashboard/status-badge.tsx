import { cn } from "@/lib/utils";
import type { BookingPaymentStatus, BookingType, ExtendedBookingStatus, ProfileStatus } from "@/lib/types";

type StatusBadgeProps = {
  status: ExtendedBookingStatus | BookingPaymentStatus | BookingType | ProfileStatus | "Active" | "Inactive";
};

const styles: Record<string, string> = {
  Pending: "border border-amber-500/30 bg-amber-500/15 text-amber-200",
  Confirmed: "border border-emerald-500/30 bg-emerald-500/15 text-emerald-200",
  Completed: "bg-secondary text-secondary-foreground",
  Cancelled: "border border-rose-500/30 bg-rose-500/15 text-rose-200",
  Declined: "border border-rose-500/30 bg-rose-500/15 text-rose-200",
  UNPAID: "bg-secondary text-secondary-foreground",
  DEPOSIT_PAID: "border border-emerald-500/30 bg-emerald-500/15 text-emerald-200",
  PAID: "border border-emerald-500/30 bg-emerald-500/15 text-emerald-200",
  REFUNDED: "border border-lime-500/30 bg-lime-500/15 text-lime-200",
  FAILED: "border border-rose-500/30 bg-rose-500/15 text-rose-200",
  FULL_SHOOT: "border border-emerald-500/30 bg-emerald-500/15 text-emerald-200",
  PHOTOGRAPHER_ONLY: "border border-lime-500/30 bg-lime-500/15 text-lime-200",
  STUDIO_ONLY: "border border-teal-500/30 bg-teal-500/15 text-teal-200",
  Published: "border border-emerald-500/30 bg-emerald-500/15 text-emerald-200",
  Draft: "bg-secondary text-secondary-foreground",
  Blocked: "border border-rose-500/30 bg-rose-500/15 text-rose-200",
  Active: "border border-emerald-500/30 bg-emerald-500/15 text-emerald-200",
  Inactive: "bg-secondary text-secondary-foreground"
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
        styles[status]
      )}
    >
      {status}
    </span>
  );
}
