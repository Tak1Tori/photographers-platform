import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface DashboardCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
}

export function DashboardCard({ label, value, hint, icon: Icon }: DashboardCardProps) {
  return (
    <Card>
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div>
            <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
            <p className="mt-1 text-xl font-semibold tracking-normal sm:mt-2 sm:text-2xl">{value}</p>
            {hint ? <p className="mt-1 hidden text-xs text-muted-foreground sm:mt-2 sm:block">{hint}</p> : null}
          </div>
          {Icon ? (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary sm:size-10">
              <Icon className="size-4 sm:size-5" aria-hidden="true" />
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
