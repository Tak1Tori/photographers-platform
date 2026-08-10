import type {
  BookingLead,
  ExternalMessage,
  PhotographerProfile,
  StudioHall,
  StudioProfile
} from "@prisma/client";

export type BookingLeadWithDetails = BookingLead & {
  photographerProfile?: Pick<PhotographerProfile, "id" | "name" | "city" | "hourlyRate"> | null;
  studioProfile?: Pick<StudioProfile, "id" | "name" | "city" | "address"> | null;
  studioHall?: (Pick<StudioHall, "id" | "name" | "hourlyRate" | "capacity"> & {
    studio?: Pick<StudioProfile, "id" | "name" | "city" | "address"> | null;
  }) | null;
  externalMessage?: Pick<ExternalMessage, "id" | "externalMessageId" | "text"> | null;
};

export interface ExternalBookingClientInput {
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientComment?: string;
}
