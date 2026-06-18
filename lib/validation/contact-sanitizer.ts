const contactPatterns = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(?:https?:\/\/|www\.)\S+/i,
  /\b[\w-]+\.(?:com|kz|ru|net|org|io|app|co|me|online|site|info|biz|photography|studio)\b/i,
  /\b(?:wa\.me|whatsapp\.com|t\.me|telegram\.me|instagram\.com|instagr\.am)\/\S*/i,
  /(^|[\s(])@[a-zA-Z0-9_]{3,32}\b/,
  /(?:\+?\s*7|8)?[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/,
  /\b\d{3}[\s-]+\d{3}[\s-]+\d{2,4}\b/
];

export const CONTACT_INFO_ERROR =
  "Контакты будут доступны после оплаты депозита. Уберите номер телефона, email, ссылку или username из описания.";

export function containsContactInfo(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  return contactPatterns.some((pattern) => pattern.test(normalized));
}

export function validateNoContactInfo(text: string): { valid: boolean; error?: string } {
  if (containsContactInfo(text)) {
    return { valid: false, error: CONTACT_INFO_ERROR };
  }

  return { valid: true };
}

export function sanitizeUserText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);
}
