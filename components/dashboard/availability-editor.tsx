"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AvailabilitySlot } from "@/lib/types";

interface AvailabilityEditorProps {
  title: string;
  slots: AvailabilitySlot[];
}

export function AvailabilityEditor({ title, slots }: AvailabilityEditorProps) {
  const [items, setItems] = useState(slots);
  const days = Array.from(new Set(items.map((slot) => slot.day)));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        {days.map((day) => (
          <div key={day} className="rounded-lg border border-border p-4">
            <p className="font-medium">{day}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {items
                .filter((slot) => slot.day === day)
                .map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() =>
                      setItems((current) =>
                        current.map((item) =>
                          item.id === slot.id ? { ...item, enabled: !item.enabled } : item
                        )
                      )
                    }
                    className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                      slot.enabled
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-secondary text-muted-foreground"
                    }`}
                  >
                    {slot.time}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
