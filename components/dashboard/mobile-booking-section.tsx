"use client";

import { useState, type ReactNode } from "react";
import { CalendarClock, ChevronDown, CreditCard, MapPin, UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MobileBookingSectionProps {
  title: string;
  icon?: "calendar" | "location" | "user" | "payment";
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function MobileBookingSection({
  title,
  icon,
  children,
  className,
  contentClassName
}: MobileBookingSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = icon ? icons[icon] : null;

  return (
    <Card className={className}>
      <CardHeader className="p-0 md:p-5 md:pb-0">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 p-5 text-left md:cursor-default md:p-0"
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
        >
          <CardTitle className="flex items-center gap-2">
            {Icon ? <Icon className="size-5" aria-hidden="true" /> : null}
            {title}
          </CardTitle>
          <ChevronDown
            className={cn(
              "size-5 shrink-0 text-muted-foreground transition-transform duration-200 md:hidden",
              isOpen && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>
      </CardHeader>
      <CardContent
        className={cn(
          "gap-4 px-5 pb-5 md:grid md:px-5",
          isOpen ? "grid" : "hidden",
          contentClassName
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}

const icons = {
  calendar: CalendarClock,
  location: MapPin,
  user: UserRound,
  payment: CreditCard
};
