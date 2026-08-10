import type { Metadata } from "next";
import { LegalSourceDocument } from "@/components/legal/legal-source-document";

export const metadata: Metadata = { title: "Правила оплаты и возврата | Framely" };

export default function PaymentAndRefundPage() {
  return <LegalSourceDocument documentKey="payment-and-refund" />;
}
