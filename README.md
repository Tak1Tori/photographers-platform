# photographers-platform

## Telegram assistant v2.2

Env:

```env
TELEGRAM_BOT_TOKEN=""
TELEGRAM_WEBHOOK_SECRET=""
TELEGRAM_BOT_USERNAME=""
NEXT_PUBLIC_APP_URL="https://your-domain.vercel.app"
```

Webhook URL:

```text
https://your-domain.vercel.app/api/integrations/telegram/webhook
```

Local test через ngrok:

```bash
ngrok http 3000
```

Затем поставьте webhook в Telegram Bot API с secret token:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://YOUR_NGROK_URL/api/integrations/telegram/webhook","secret_token":"YOUR_SECRET"}'
```

Manual flow:

1. Откройте `/dashboard/photographer/calendar` или `/dashboard/studio/calendar`.
2. Нажмите `Подключить Telegram`.
3. В Telegram отправьте боту `/start CODE`.
4. Проверьте команды:
   - `Занят завтра с 14 до 17`
   - `/busy 28.06 14:00-17:00 съемка`
   - `/week`
   - `/free завтра`
   - `/studio_halls`
   - `/busy_hall Loft 28.06 14:00-17:00 аренда`
   - `/lead Айдана завтра 14:00-16:00 портрет`
   - `/book Тимур 28.06 12:00-14:00`
   - `/lead_hall Loft 28.06 14:00-16:00 съемка`
5. После сообщения о занятости нажмите inline-кнопку `Добавить`.
6. Событие появится в Smart Calendar как `Telegram` busy event.

Booking leads flow:

1. Фотограф отправляет `/lead Имя дата время`, студия отправляет `/lead_hall Зал дата время`.
2. Бот создает `BookingLead` и показывает кнопки: `Создать ссылку`, `Как занятость`, `Отклонить`.
3. `Создать ссылку` повторно проверяет календарь, ставит hold на 2 часа и отдает `/external-booking/[token]`.
4. Клиент открывает ссылку, заполняет контакты и оплачивает mock-депозит.
5. После mock payment существующий payment webhook конвертирует hold в событие календаря.
