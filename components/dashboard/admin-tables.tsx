"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  formatPrice,
  getPhotographerById,
  getStudioById,
  getStyleById,
  getStyleTitles
} from "@/lib/mock-data";
import type { Booking, BookingStatus, Photographer, ProfileStatus, Studio } from "@/lib/types";

interface AdminTablesProps {
  bookings: Booking[];
  photographers: Photographer[];
  studios: Studio[];
}

const statuses: Array<"All" | BookingStatus> = [
  "All",
  "Pending",
  "Confirmed",
  "Completed",
  "Cancelled"
];

export function AdminTables({ bookings, photographers, studios }: AdminTablesProps) {
  const [bookingStatus, setBookingStatus] = useState<"All" | BookingStatus>("All");
  const [photographerStatuses, setPhotographerStatuses] = useState<Record<string, ProfileStatus>>(
    Object.fromEntries(photographers.map((photographer) => [photographer.id, "Published"]))
  );
  const [studioStatuses, setStudioStatuses] = useState<Record<string, ProfileStatus>>(
    Object.fromEntries(studios.map((studio) => [studio.id, "Published"]))
  );

  const filteredBookings = useMemo(
    () =>
      bookingStatus === "All"
        ? bookings
        : bookings.filter((booking) => booking.status === bookingStatus),
    [bookingStatus, bookings]
  );

  return (
    <div className="grid gap-8">
      <section>
        <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <h2 className="text-2xl font-semibold tracking-normal">Bookings management</h2>
          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <Button
                key={status}
                size="sm"
                variant={bookingStatus === status ? "default" : "outline"}
                onClick={() => setBookingStatus(status)}
              >
                {status}
              </Button>
            ))}
          </div>
        </div>
        <AdminBookingTable bookings={filteredBookings} />
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold tracking-normal">Photographers management</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border bg-secondary/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Имя</th>
                <th className="px-4 py-3 font-medium">Город</th>
                <th className="px-4 py-3 font-medium">Стили</th>
                <th className="px-4 py-3 font-medium">Цена</th>
                <th className="px-4 py-3 font-medium">Рейтинг</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium">Брони</th>
                <th className="px-4 py-3 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {photographers.map((photographer) => (
                <tr key={photographer.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{photographer.name}</td>
                  <td className="px-4 py-3">{photographer.city}</td>
                  <td className="px-4 py-3">{getStyleTitles(photographer.specializationIds).join(", ")}</td>
                  <td className="px-4 py-3">{formatPrice(photographer.pricePerHour)}</td>
                  <td className="px-4 py-3">{photographer.rating}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={photographerStatuses[photographer.id]} />
                  </td>
                  <td className="px-4 py-3">
                    {bookings.filter((booking) => booking.photographerId === photographer.id).length}
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      onApprove={() =>
                        setPhotographerStatuses((current) => ({
                          ...current,
                          [photographer.id]: "Published"
                        }))
                      }
                      onBlock={() =>
                        setPhotographerStatuses((current) => ({
                          ...current,
                          [photographer.id]: "Blocked"
                        }))
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold tracking-normal">Studios management</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border bg-secondary/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Название</th>
                <th className="px-4 py-3 font-medium">Город</th>
                <th className="px-4 py-3 font-medium">Адрес</th>
                <th className="px-4 py-3 font-medium">Залы</th>
                <th className="px-4 py-3 font-medium">Цена от</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium">Брони</th>
                <th className="px-4 py-3 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {studios.map((studio) => (
                <tr key={studio.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{studio.name}</td>
                  <td className="px-4 py-3">{studio.city}</td>
                  <td className="px-4 py-3">{studio.address}</td>
                  <td className="px-4 py-3">{studio.halls.length}</td>
                  <td className="px-4 py-3">
                    {formatPrice(Math.min(...studio.halls.map((hall) => hall.pricePerHour)))}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={studioStatuses[studio.id]} />
                  </td>
                  <td className="px-4 py-3">
                    {bookings.filter((booking) => booking.studioId === studio.id).length}
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      onApprove={() =>
                        setStudioStatuses((current) => ({
                          ...current,
                          [studio.id]: "Published"
                        }))
                      }
                      onBlock={() =>
                        setStudioStatuses((current) => ({
                          ...current,
                          [studio.id]: "Blocked"
                        }))
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AdminBookingTable({ bookings }: { bookings: Booking[] }) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Под выбранный фильтр нет бронирований.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-border bg-secondary/60 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Booking ID</th>
            <th className="px-4 py-3 font-medium">Клиент</th>
            <th className="px-4 py-3 font-medium">Фотограф</th>
            <th className="px-4 py-3 font-medium">Студия</th>
            <th className="px-4 py-3 font-medium">Стиль</th>
            <th className="px-4 py-3 font-medium">Дата</th>
            <th className="px-4 py-3 font-medium">Тип</th>
            <th className="px-4 py-3 font-medium">Сумма</th>
            <th className="px-4 py-3 font-medium">Статус</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={booking.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium">{booking.id}</td>
              <td className="px-4 py-3">{booking.clientName}</td>
              <td className="px-4 py-3">{getPhotographerById(booking.photographerId)?.name}</td>
              <td className="px-4 py-3">{getStudioById(booking.studioId)?.name}</td>
              <td className="px-4 py-3">{getStyleById(booking.styleId)?.title}</td>
              <td className="px-4 py-3">{booking.date}</td>
              <td className="px-4 py-3"><StatusBadge status={booking.bookingType ?? "FULL_SHOOT"} /></td>
              <td className="px-4 py-3">{formatPrice(booking.totalAmount)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={booking.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowActions({ onApprove, onBlock }: { onApprove: () => void; onBlock: () => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline">View</Button>
      <Button size="sm" onClick={onApprove}>Approve</Button>
      <Button size="sm" variant="outline" onClick={onBlock}>Block</Button>
    </div>
  );
}
