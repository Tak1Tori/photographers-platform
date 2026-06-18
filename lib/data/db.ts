export function canUseDatabase() {
  return Boolean(process.env.DATABASE_URL);
}
