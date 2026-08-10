import { StudioConfirmationRequestStatus, UserRole } from "@prisma/client";
import Link from "next/link";
import { requireSession } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { dateKey, timeLabel } from "@/lib/calendar/time-utils";
import { expirePendingStudioConfirmationRequests } from "@/lib/studio-confirmations/studio-confirmation-service";

export default async function AdminStudioConfirmationsPage() {
  await requireSession([UserRole.ADMIN]);
  await expirePendingStudioConfirmationRequests();
  const requests = await prisma.studioConfirmationRequest.findMany({
    include: { studioProfile: true, studioHall: true, booking: true, client: true },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <h1 className="text-3xl font-semibold tracking-normal md:text-5xl">Studio confirmations</h1>
      <div className="mt-8 overflow-hidden rounded-lg border border-border">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-secondary/40 text-muted-foreground">
            <tr>
              <th className="p-4">Заявка</th>
              <th className="p-4">Студия</th>
              <th className="p-4">Дата</th>
              <th className="p-4">Клиент</th>
              <th className="p-4">Суммы</th>
              <th className="p-4">Статус</th>
              <th className="p-4">Бронь</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} className="border-t border-border">
                <td className="p-4 font-mono text-xs">{request.id}</td>
                <td className="p-4">
                  <p className="font-medium">{request.studioName}</p>
                  <p className="text-muted-foreground">{request.hallName}</p>
                </td>
                <td className="p-4">{dateKey(request.startTime)} · {timeLabel(request.startTime)}</td>
                <td className="p-4">
                  <p>{request.clientName ?? "-"}</p>
                  <p className="text-muted-foreground">{request.clientPhone ?? ""}</p>
                </td>
                <td className="p-4">
                  <p>Услуга: {formatPrice(request.totalServicePrice)}</p>
                  <p>Сбор: {formatPrice(request.platformFeeAmount)}</p>
                </td>
                <td className="p-4"><StatusBadge status={request.status} /></td>
                <td className="p-4">
                  {request.booking ? (
                    <Link href={`/dashboard/client/bookings/${request.booking.bookingNumber}`} className="text-primary">
                      {request.booking.bookingNumber}
                    </Link>
                  ) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: StudioConfirmationRequestStatus }) {
  return (
    <span className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary">
      {status}
    </span>
  );
}

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₸`;
}
