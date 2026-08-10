import { NextResponse } from "next/server";
import { autoCompletePastBookings } from "@/lib/bookings/status-service";
import { expireOldHolds } from "@/lib/calendar/hold-service";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const [holds, bookings] = await Promise.all([
    expireOldHolds(),
    autoCompletePastBookings()
  ]);

  return NextResponse.json({
    ok: true,
    expired: holds.count,
    completed: bookings.count
  });
}
