import type {
  AvailableSlot,
  Booking,
  Photographer,
  PhotoStyle,
  Studio
} from "@/lib/types";

type PrismaStyleLike = {
  id: string;
  name: string;
  slug: string;
  description: string;
  startingPrice: number;
  imageUrl: string;
};

type PrismaPhotographerLike = {
  id: string;
  name: string;
  city: string;
  bio: string;
  avatarUrl: string;
  hourlyRate: number;
  rating: number;
  styles?: Array<{ slug: string }>;
  portfolioItems?: Array<{ imageUrl: string }>;
  availabilitySlots?: Array<{
    id: string;
    date: Date;
    startTime: string;
    isAvailable: boolean;
  }>;
};

type PrismaStudioLike = {
  id: string;
  name: string;
  city: string;
  address: string;
  description: string;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  rules: string;
  halls?: Array<{
    id: string;
    name: string;
    capacity: number;
    hourlyRate: number;
    imageUrl: string;
    amenities: unknown;
    availabilitySlots?: Array<{
      id: string;
      date: Date;
      startTime: string;
      isAvailable: boolean;
    }>;
  }>;
};

type PrismaBookingLike = {
  id: string;
  bookingNumber: string;
  clientId?: string | null;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientComment?: string | null;
  bookingType?: string;
  photographerId?: string | null;
  studioId?: string | null;
  styleId?: string | null;
  shootType?: string | null;
  shootDescription?: string | null;
  locationType?: string | null;
  city?: string | null;
  district?: string | null;
  addressDetails?: string | null;
  peopleCount?: number | null;
  equipmentNeeded?: unknown;
  specialRequirements?: string | null;
  rentalPurpose?: string | null;
  needsEquipment?: boolean | null;
  selectedAmenities?: unknown;
  date: Date;
  startTime: string;
  durationHours: number;
  photographerPrice: number;
  studioPrice: number;
  serviceFee: number;
  totalPrice: number;
  depositAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  platformCommission?: number | null;
  providerFee?: number | null;
  netPlatformRevenue?: number | null;
  paymentStatus?: string;
  completedAt?: Date | null;
  finalPaymentRequestedAt?: Date | null;
  fullyPaidAt?: Date | null;
  payoutStatus?: string | null;
  payoutAmount?: number | null;
  rescheduleRequestedAt?: Date | null;
  rescheduleComment?: string | null;
  status: string;
  style?: { slug: string } | null;
  photographer?: { name: string } | null;
  studio?: { name: string; address: string } | null;
  studioHall?: { name: string } | null;
};

export function mapStyle(style: PrismaStyleLike): PhotoStyle {
  return {
    id: style.slug,
    title: style.name,
    description: style.description,
    imageUrl: style.imageUrl,
    startingPrice: style.startingPrice
  };
}

export function mapPhotographer(profile: PrismaPhotographerLike): Photographer {
  return {
    id: profile.id,
    name: profile.name,
    city: profile.city,
    bio: profile.bio,
    specializationIds: profile.styles?.map((style) => style.slug) ?? [],
    pricePerHour: profile.hourlyRate,
    rating: profile.rating,
    imageUrl: profile.avatarUrl,
    portfolio: profile.portfolioItems?.map((item) => item.imageUrl) ?? [],
    availableSlotIds:
      profile.availabilitySlots
        ?.filter((slot) => slot.isAvailable)
        .map((slot) => slot.id) ?? []
  };
}

export function mapStudio(studio: PrismaStudioLike): Studio {
  const primaryHall = studio.halls?.[0];
  const amenities = Array.isArray(primaryHall?.amenities)
    ? (primaryHall?.amenities as string[])
    : [];

  return {
    id: studio.id,
    name: studio.name,
    hallName: primaryHall?.name ?? "Main hall",
    city: studio.city,
    district: studio.address.split(",").at(-1)?.trim() ?? studio.city,
    address: studio.address,
    description: studio.description,
    pricePerHour: primaryHall?.hourlyRate ?? 0,
    capacity: primaryHall?.capacity ?? 0,
    rating: 4.8,
    imageUrl: studio.imageUrl ?? primaryHall?.imageUrl ?? "",
    gallery: [studio.imageUrl, ...(studio.halls?.map((hall) => hall.imageUrl) ?? [])].filter(
      Boolean
    ) as string[],
    amenities,
    rules: studio.rules.split("\n").filter(Boolean),
    halls:
      studio.halls?.map((hall) => ({
        id: hall.id,
        name: hall.name,
        capacity: hall.capacity,
        pricePerHour: hall.hourlyRate,
        amenities: Array.isArray(hall.amenities) ? (hall.amenities as string[]) : [],
        imageUrl: hall.imageUrl,
        status: "Active"
      })) ?? [],
    suitableStyleIds: [],
    availableSlotIds:
      studio.halls
        ?.flatMap((hall) => hall.availabilitySlots ?? [])
        .filter((slot) => slot.isAvailable)
        .map((slot) => slot.id) ?? [],
    primaryHallId: primaryHall?.id
  };
}

export function mapBooking(booking: PrismaBookingLike): Booking {
  return {
    id: booking.bookingNumber,
    dbId: booking.id,
    clientId: booking.clientId ?? undefined,
    clientName: booking.clientName,
    clientEmail: booking.clientEmail,
    clientPhone: booking.clientPhone,
    clientComment: booking.clientComment ?? undefined,
    bookingType: mapBookingType(booking.bookingType),
    photographerId: booking.photographerId ?? "",
    studioId: booking.studioId ?? "",
    photographerName: booking.photographer?.name ?? undefined,
    studioName: booking.studio?.name ?? undefined,
    studioAddress: booking.studio?.address ?? undefined,
    styleId: booking.style?.slug ?? booking.styleId ?? "",
    shootType: booking.shootType ?? undefined,
    shootDescription: booking.shootDescription ?? undefined,
    locationType: booking.locationType ?? undefined,
    city: booking.city ?? undefined,
    district: booking.district ?? undefined,
    addressDetails: booking.addressDetails ?? undefined,
    peopleCount: booking.peopleCount ?? undefined,
    equipmentNeeded: Array.isArray(booking.equipmentNeeded)
      ? (booking.equipmentNeeded as string[])
      : undefined,
    specialRequirements: booking.specialRequirements ?? undefined,
    rentalPurpose: booking.rentalPurpose ?? undefined,
    needsEquipment: booking.needsEquipment ?? undefined,
    selectedAmenities: Array.isArray(booking.selectedAmenities)
      ? (booking.selectedAmenities as string[])
      : undefined,
    hallName: booking.studioHall?.name ?? "Main hall",
    date: booking.date.toISOString().slice(0, 10),
    time: booking.startTime,
    durationHours: booking.durationHours,
    photographerTotal: booking.photographerPrice,
    studioTotal: booking.studioPrice,
    serviceFee: booking.serviceFee,
    totalAmount: booking.totalPrice,
    depositAmount: booking.depositAmount ?? 0,
    paidAmount: booking.paidAmount ?? 0,
    remainingAmount: booking.remainingAmount ?? booking.totalPrice,
    platformCommission: booking.platformCommission ?? undefined,
    providerFee: booking.providerFee ?? undefined,
    netPlatformRevenue: booking.netPlatformRevenue ?? undefined,
    paymentStatus: mapBookingPaymentStatus(booking.paymentStatus),
    completedAt: booking.completedAt?.toISOString(),
    finalPaymentRequestedAt: booking.finalPaymentRequestedAt?.toISOString(),
    fullyPaidAt: booking.fullyPaidAt?.toISOString(),
    payoutStatus: booking.payoutStatus ?? undefined,
    payoutAmount: booking.payoutAmount ?? undefined,
    rescheduleRequestedAt: booking.rescheduleRequestedAt?.toISOString(),
    rescheduleComment: booking.rescheduleComment ?? undefined,
    status: mapBookingStatus(booking.status)
  };
}

function mapBookingType(type?: string): Booking["bookingType"] {
  const map: Record<string, Booking["bookingType"]> = {
    FULL_SHOOT: "FULL_SHOOT",
    PHOTOGRAPHER_ONLY: "PHOTOGRAPHER_ONLY",
    STUDIO_ONLY: "STUDIO_ONLY"
  };
  return type ? map[type] ?? "FULL_SHOOT" : "FULL_SHOOT";
}

export function mapSlots(
  slots: Array<{ id: string; date: Date; startTime: string; isAvailable: boolean }>
): AvailableSlot[] {
  const groups = new Map<string, AvailableSlot>();
  for (const slot of slots.filter((item) => item.isAvailable)) {
    const date = slot.date.toISOString().slice(0, 10);
    const label = new Intl.DateTimeFormat("ru-RU", {
      weekday: "short",
      day: "numeric",
      month: "long"
    }).format(slot.date);
    const current = groups.get(date) ?? {
      id: date,
      date,
      label,
      times: []
    };
    current.times.push(slot.startTime);
    groups.set(date, current);
  }
  return Array.from(groups.values());
}

function mapBookingStatus(status: string): Booking["status"] {
  const map: Record<string, Booking["status"]> = {
    PENDING: "Pending",
    CONFIRMED: "Confirmed",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    DECLINED: "Declined"
  };
  return map[status] ?? "Pending";
}

function mapBookingPaymentStatus(status?: string): Booking["paymentStatus"] {
  const map: Record<string, Booking["paymentStatus"]> = {
    UNPAID: "UNPAID",
    DEPOSIT_PENDING: "DEPOSIT_PENDING",
    DEPOSIT_PAID: "DEPOSIT_PAID",
    FINAL_PAYMENT_PENDING: "FINAL_PAYMENT_PENDING",
    FULLY_PAID: "FULLY_PAID",
    REFUNDED: "REFUNDED",
    FAILED: "FAILED"
  };
  return status ? map[status] ?? "UNPAID" : "UNPAID";
}
