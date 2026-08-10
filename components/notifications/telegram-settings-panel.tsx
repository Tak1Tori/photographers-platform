import { Bell, CheckCircle2, ExternalLink, Send, Unplug } from "lucide-react";
import { TelegramConnectionStatus, type TelegramConnection } from "@prisma/client";
import {
  createTelegramConnectionCodeAction,
  disconnectTelegramConnectionAction,
  sendTelegramTestNotificationAction
} from "@/app/dashboard/settings/notifications/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TelegramSettingsPanelProps = {
  connection: TelegramConnection | null;
  botUsername?: string;
};

export function TelegramSettingsPanel({
  connection,
  botUsername
}: TelegramSettingsPanelProps) {
  const isConnected = connection?.status === TelegramConnectionStatus.ACTIVE;
  const isPending = connection?.status === TelegramConnectionStatus.PENDING;
  const normalizedBotUsername = botUsername?.replace(/^@/, "");
  const botHref = normalizedBotUsername
    ? `https://t.me/${normalizedBotUsername}${connection?.connectionCode ? `?start=${connection.connectionCode}` : ""}`
    : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="size-5 text-primary" aria-hidden="true" />
          Telegram-уведомления
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Получайте быстрые уведомления о заявках, подтверждениях и напоминаниях прямо в
          Telegram. Все действия выполняются на платформе.
        </p>

        {isConnected ? (
          <div className="grid gap-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <CheckCircle2 className="size-5 text-emerald-300" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">Telegram подключен</p>
                <p className="text-sm text-muted-foreground">
                  {connection.telegramUsername
                    ? `@${connection.telegramUsername}`
                    : "Чат подключен к вашему аккаунту."}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <form action={sendTelegramTestNotificationAction}>
                <Button type="submit">
                  <Bell className="mr-2 size-4" aria-hidden="true" />
                  Отправить тестовое уведомление
                </Button>
              </form>
              <form action={disconnectTelegramConnectionAction}>
                <Button type="submit" variant="outline">
                  <Unplug className="mr-2 size-4" aria-hidden="true" />
                  Отключить Telegram
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 rounded-lg border border-border p-4">
            {isPending && connection.connectionCode ? (
              <div className="grid gap-3">
                <ol className="grid gap-2 text-sm text-muted-foreground">
                  <li>1. Откройте Telegram-бота</li>
                  <li>2. Отправьте команду:</li>
                </ol>
                <p className="text-sm text-muted-foreground">
                  Команда для подключения:
                </p>
                <div className="w-fit rounded-md border border-primary/40 bg-primary/10 px-4 py-3 font-mono text-lg text-primary">
                  /start {connection.connectionCode}
                </div>
                {connection.codeExpiresAt ? (
                  <p className="text-xs text-muted-foreground">
                    Код действует до {formatDateTime(connection.codeExpiresAt)}.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Telegram пока не подключен. Создайте код подключения и отправьте его боту.
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <form action={createTelegramConnectionCodeAction}>
                <Button type="submit">Подключить Telegram</Button>
              </form>
              {botHref ? (
                <Button asChild variant="outline">
                  <a href={botHref} target="_blank" rel="noreferrer">
                    Открыть бота
                    <ExternalLink className="ml-2 size-4" aria-hidden="true" />
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}
