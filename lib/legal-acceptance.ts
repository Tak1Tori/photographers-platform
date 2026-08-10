import { LegalDocumentType } from "@prisma/client";
import { legalDocuments, privacyLegalDocument } from "@/lib/legal-documents";
import { prisma } from "@/lib/prisma";

type AcceptanceInput = {
  userId: string;
  documentTypes: LegalDocumentType[];
  source: string;
};

const documentVersions: Record<LegalDocumentType, string> = {
  TERMS: legalDocuments.terms.version,
  PRIVACY: privacyLegalDocument.version,
  OFFER: legalDocuments.offer.version,
  PAYMENT_AND_REFUND: legalDocuments["payment-and-refund"].version,
  COOKIES: legalDocuments.cookies.version
};

export async function recordLegalAcceptances({ userId, documentTypes, source }: AcceptanceInput) {
  const uniqueDocumentTypes = Array.from(new Set(documentTypes));

  await prisma.legalAcceptance.createMany({
    data: uniqueDocumentTypes.map((documentType) => ({
      userId,
      documentType,
      documentVersion: documentVersions[documentType],
      source
    })),
    skipDuplicates: true
  });
}
