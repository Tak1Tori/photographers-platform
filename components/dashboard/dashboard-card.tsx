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
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
            {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
          </div>
          {Icon ? (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
