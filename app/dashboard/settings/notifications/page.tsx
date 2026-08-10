import { TelegramConnectionStatus } from "@prisma/client";
import { TelegramSettingsPanel } from "@/components/notifications/telegram-settings-panel";
import { requireSession } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ClientNotificationSettingsPage() {
  const session = await requireSession();
  const connection = await getConnection(session.user.id);

  return (
    <section className="section">
      <div className="container max-w-4xl">
        <TelegramSettingsPanel
          connection={connection}
          botUsername={process.env.TELEGRAM_BOT_USERNAME ?? process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}
        />
      </div>
    </section>
  );
}

function getConnection(userId: string) {
  return prisma.telegramConnection.findFirst({
    where: {
      userId,
      status: { in: [TelegramConnectionStatus.ACTIVE, TelegramConnectionStatus.PENDING] }
    },
    orderBy: { createdAt: "desc" }
  });
}
