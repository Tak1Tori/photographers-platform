import type { Metadata } from "next";
import { LegalSourceDocument } from "@/components/legal/legal-source-document";

export const metadata: Metadata = { title: "Политика Cookies | Framely" };

export default function CookiesPage() {
  return <LegalSourceDocument documentKey="cookies" />;
}
