import { readFileSync } from "node:fs";
import { join } from "node:path";

export type LegalDocumentKey = "terms" | "offer" | "payment-and-refund" | "cookies";

export type LegalAcceptanceDocument =
  | "TERMS"
  | "PRIVACY"
  | "OFFER"
  | "PAYMENT_AND_REFUND"
  | "COOKIES";

type LegalDocumentDefinition = {
  key: LegalDocumentKey;
  title: string;
  description: string;
  sourceFile: string;
  version: string;
  documentType: LegalAcceptanceDocument;
};

export type LegalDocumentSection = {
  id: string;
  title: string;
  paragraphs: string[];
};

export const legalDocuments: Record<LegalDocumentKey, LegalDocumentDefinition> = {
  terms: {
    key: "terms",
    title: "Пользовательское соглашение",
    description: "Онлайн-платформы Framely. Редакция от 5 августа 2026 года.",
    sourceFile: "terms-v2.txt",
    version: "2026-08-05",
    documentType: "TERMS"
  },
  offer: {
    key: "offer",
    title: "Публичная оферта",
    description: "На оказание цифровых услуг онлайн-платформы Framely. Редакция от 5 августа 2026 года.",
    sourceFile: "offer-v1.txt",
    version: "2026-08-05",
    documentType: "OFFER"
  },
  "payment-and-refund": {
    key: "payment-and-refund",
    title: "Правила онлайн-оплаты и возврата",
    description: "Для платформы Framely. Редакция от 5 августа 2026 года.",
    sourceFile: "payment-and-refund-v3.txt",
    version: "2026-08-05",
    documentType: "PAYMENT_AND_REFUND"
  },
  cookies: {
    key: "cookies",
    title: "Политика Cookies",
    description: "Онлайн-платформы Framely. Редакция от 5 августа 2026 года.",
    sourceFile: "cookies-v1.txt",
    version: "2026-08-05",
    documentType: "COOKIES"
  }
};

export const privacyLegalDocument = {
  version: "2026-08-03",
  documentType: "PRIVACY" as const,
  href: "/privacy-policy"
};

export function getLegalDocument(key: LegalDocumentKey) {
  const document = legalDocuments[key];
  const lines = readFileSync(
    join(process.cwd(), "legal-source", document.sourceFile),
    "utf8"
  )
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const firstSectionIndex = lines.findIndex(isSectionHeading);
  const intro = lines
    .slice(0, Math.max(firstSectionIndex, 0))
    .filter((line) => line !== "Содержание" && !/^\d+\.\s/.test(line))
    .filter((line) => !/^Редакция от /i.test(line))
    .filter((line) => line !== document.title && !/^онлайн-платформы Framely$/i.test(line))
    .join(" ");

  return {
    ...document,
    intro,
    sections: parseSections(lines.slice(Math.max(firstSectionIndex, 0)))
  };
}

function parseSections(lines: string[]): LegalDocumentSection[] {
  const sections: LegalDocumentSection[] = [];
  let current: LegalDocumentSection | undefined;

  for (const line of lines) {
    if (isSectionHeading(line)) {
      current = {
        id: `section-${sections.length + 1}`,
        title: line,
        paragraphs: []
      };
      sections.push(current);
      continue;
    }

    if (current) current.paragraphs.push(line);
  }

  return sections;
}

function isSectionHeading(line: string) {
  return /^\d+\.\s+\S/.test(line) || /^КРАТКАЯ СХЕМА/.test(line);
}
