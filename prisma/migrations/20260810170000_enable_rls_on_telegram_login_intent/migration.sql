-- Telegram OIDC intents are internal server-side records. Keep them inaccessible
-- through Supabase's public Data API; Prisma uses the server database role.
ALTER TABLE public."TelegramLoginIntent" ENABLE ROW LEVEL SECURITY;
