import { cn } from "@/lib/utils";

export function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        "absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-semibold text-white"
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
