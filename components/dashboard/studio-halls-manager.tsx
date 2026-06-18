"use client";

import { useState } from "react";
import Image from "next/image";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { formatPrice } from "@/lib/mock-data";
import type { StudioHall } from "@/lib/types";

const placeholder =
  "https://images.unsplash.com/photo-1604014237800-1c9102c219da?auto=format&fit=crop&w=900&q=80";

export function StudioHallsManager({ initialHalls }: { initialHalls: StudioHall[] }) {
  const [halls, setHalls] = useState(initialHalls);

  function addHall() {
    setHalls((current) => [
      {
        id: `hall-${current.length + 1}`,
        name: `New Hall ${current.length + 1}`,
        capacity: 4,
        pricePerHour: 15000,
        amenities: ["Гримерка", "Wi-Fi"],
        status: "Inactive",
        imageUrl: placeholder
      },
      ...current
    ]);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <CardTitle>Залы студии</CardTitle>
          <Button size="sm" onClick={addHall}>
            <Plus className="size-4" aria-hidden="true" />
            Add hall
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {halls.map((hall) => (
            <div key={hall.id ?? hall.name} className="overflow-hidden rounded-lg border border-border">
              <div className="relative aspect-[16/9]">
                <Image
                  src={hall.imageUrl ?? placeholder}
                  alt={hall.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="grid gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{hall.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      до {hall.capacity} человек · {formatPrice(hall.pricePerHour)} / час
                    </p>
                  </div>
                  <StatusBadge status={hall.status ?? "Active"} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {(hall.amenities ?? []).map((amenity) => (
                    <span key={amenity} className="rounded-md bg-muted px-2 py-1 text-xs">
                      {amenity}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setHalls((current) =>
                        current.map((item) =>
                          item.id === hall.id
                            ? {
                                ...item,
                                status: item.status === "Active" ? "Inactive" : "Active"
                              }
                            : item
                        )
                      )
                    }
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setHalls((current) => current.filter((item) => item.id !== hall.id))
                    }
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
