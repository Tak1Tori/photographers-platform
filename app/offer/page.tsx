import type { Metadata } from "next";
import { LegalSourceDocument } from "@/components/legal/legal-source-document";

export const metadata: Metadata = { title: "Публичная оферта | Framely" };

export default function OfferPage() {
  return <LegalSourceDocument documentKey="offer" />;
}
