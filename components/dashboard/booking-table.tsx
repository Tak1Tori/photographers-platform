"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { formatPrice, getPhotographerById, getStudioById, getStyleById } from "@/lib/mock-data";
import type { Booking, BookingStatus } from "@/lib/types";

interface BookingTableProps {
  bookings: Booking[];
  mode: "photographer" | "studio" | "admin";
}

export function BookingTable({ bookings, mode }: BookingTableProps) {
  const [rows, setRows] = useState(bookings);

  function updateStatus(id: string, status: BookingStatus) {
    setRows((current) =>
      current.map((booking) => (booking.id === id ? { ...booking, status } : booking))
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Бронирований пока нет.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="border-b border-border bg-secondary/60 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Booking ID</th>
            <th className="px-4 py-3 font-medium">Клиент</th>
            {mode === "studio" ? (
              <th className="px-4 py-3 font-medium">Фотограф</th>
            ) : null}
            {mode === "photographer" || mode === "admin" ? (
              <th className="px-4 py-3 font-medium">Студия</th>
            ) : null}
            <th className="px-4 py-3 font-medium">Стиль</th>
            <th className="px-4 py-3 font-medium">Дата</th>
            <th className="px-4 py-3 font-medium">Время</th>
            <th className="px-4 py-3 font-medium">Тип</th>
            <th className="px-4 py-3 font-medium">Сумма</th>
            <th className="px-4 py-3 font-medium">Статус</th>
            <th className="px-4 py-3 font-medium">Действия</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((booking) => (
            <tr key={booking.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium">{booking.id}</td>
              <td className="px-4 py-3">{booking.clientName}</td>
              {mode === "studio" ? (
                <td className="px-4 py-3">{getPhotographerById(booking.photographerId)?.name}</td>
              ) : null}
              {mode === "photographer" || mode === "admin" ? (
                <td className="px-4 py-3">{getStudioById(booking.studioId)?.name}</td>
              ) : null}
              <td className="px-4 py-3">{getStyleById(booking.styleId)?.title}</td>
              <td className="px-4 py-3">{booking.date}</td>
              <td className="px-4 py-3">{booking.time}</td>
              <td className="px-4 py-3"><StatusBadge status={booking.bookingType ?? "FULL_SHOOT"} /></td>
              <td className="px-4 py-3">{formatPrice(booking.totalAmount)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={booking.status} />
              </td>
              <td className="px-4 py-3">
                {booking.status === "Pending" ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateStatus(booking.id, "Confirmed")}>
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(booking.id, "Cancelled")}
                    >
                      Decline
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
