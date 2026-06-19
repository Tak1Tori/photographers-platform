import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getUnreadNotificationsCount,
  getUserNotifications
} from "@/lib/notifications/notification-service";

export async function GET() {
  const session = await getSession();

  if (!session?.user) {
    return NextResponse.json({ notifications: [], unreadCount: 0 }, { status: 401 });
  }

  const [notifications, unreadCount] = await Promise.all([
    getUserNotifications(session.user.id, 7),
    getUnreadNotificationsCount(session.user.id)
  ]);

  return NextResponse.json({ notifications, unreadCount });
}
