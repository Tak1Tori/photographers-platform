"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import {
  markAllNotificationsAsRead,
  markNotificationAsRead
} from "@/lib/notifications/notification-service";

type ActionResult = {
  success: boolean;
  message?: string;
  error?: string;
};

async function requireUserId() {
  const session = await getSession();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

export async function markNotificationAsReadAction(notificationId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await markNotificationAsRead(notificationId, userId);
    revalidateNotificationPaths();
    return { success: true, message: "Уведомление прочитано." };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Не удалось обновить уведомление"
    };
  }
}

export async function markAllNotificationsAsReadAction(): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await markAllNotificationsAsRead(userId);
    revalidateNotificationPaths();
    return { success: true, message: "Все уведомления отмечены прочитанными." };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Не удалось обновить уведомления"
    };
  }
}

function revalidateNotificationPaths() {
  revalidatePath("/");
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard/client");
  revalidatePath("/dashboard/photographer");
  revalidatePath("/dashboard/studio");
  revalidatePath("/admin");
}
