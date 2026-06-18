import { prisma } from "@/lib/prisma";
import {
  getStudioById as getMockStudioById,
  mockStudioProfile,
  studios as mockStudios
} from "@/lib/mock-data";
import { canUseDatabase } from "@/lib/data/db";
import { getDevStore } from "@/lib/data/dev-store";
import { mapStudio } from "@/lib/data/mappers";
import type { DashboardAvailabilitySlot, StudioHall, StudioProfile } from "@/lib/types";

interface StudioFilters {
  city?: string;
  style?: string;
}

const studioInclude = {
  halls: {
    include: {
      availabilitySlots: true
    }
  }
};

export async function getStudios(filters: StudioFilters = {}) {
  if (!canUseDatabase()) {
    return mockStudios.filter((studio) => (filters.city ? studio.city === filters.city : true));
  }

  try {
    const studios = await prisma.studioProfile.findMany({
      where: {
        status: "PUBLISHED",
        city: filters.city
      },
      include: studioInclude,
      orderBy: { name: "asc" }
    });
    return studios.length > 0
      ? studios.map(mapStudio)
      : mockStudios.filter((studio) => (filters.city ? studio.city === filters.city : true));
  } catch {
    return mockStudios.filter((studio) => (filters.city ? studio.city === filters.city : true));
  }
}

export async function getStudioById(id?: string) {
  if (!id) {
    return undefined;
  }

  if (!canUseDatabase()) {
    return getMockStudioById(id);
  }

  try {
    const studio = await prisma.studioProfile.findUnique({
      where: { id },
      include: studioInclude
    });
    return studio ? mapStudio(studio) : getMockStudioById(id);
  } catch {
    return getMockStudioById(id);
  }
}

export async function getStudioForBooking(id?: string) {
  if (!id) return undefined;

  if (!canUseDatabase()) {
    return getMockStudioById(id);
  }

  try {
    const studio = await prisma.studioProfile.findFirst({
      where: { id, status: "PUBLISHED" },
      include: studioInclude
    });
    return studio ? mapStudio(studio) : undefined;
  } catch {
    return getMockStudioById(id);
  }
}

export async function getStudioHallForBooking(hallId?: string) {
  if (!hallId) return undefined;

  if (!canUseDatabase()) {
    for (const studio of mockStudios) {
      const hall = studio.halls.find((item) => item.id === hallId);
      if (hall) return { studio, hall };
    }
    return undefined;
  }

  try {
    const hall = await prisma.studioHall.findFirst({
      where: {
        id: hallId,
        status: "ACTIVE",
        studio: { status: "PUBLISHED" }
      },
      include: {
        studio: {
          include: studioInclude
        }
      }
    });

    if (!hall) return undefined;
    const studio = mapStudio(hall.studio);
    return {
      studio,
      hall: studio.halls.find((item) => item.id === hall.id)
    };
  } catch {
    for (const studio of mockStudios) {
      const hall = studio.halls.find((item) => item.id === hallId);
      if (hall) return { studio, hall };
    }
    return undefined;
  }
}

export async function getStudioProfileByOwnerId(ownerId: string): Promise<StudioProfile> {
  if (!canUseDatabase()) {
    return (await getDevStore()).studioProfile;
  }

  try {
    const studio = await prisma.studioProfile.findFirst({
      where: { ownerId },
      include: studioInclude,
      orderBy: { createdAt: "asc" }
    });

    if (!studio) {
      return mockStudioProfile;
    }

    return {
      id: studio.id,
      studioId: studio.id,
      name: studio.name,
      city: studio.city,
      address: studio.address,
      imageUrl: studio.imageUrl ?? undefined,
      imagePublicId: studio.imagePublicId ?? undefined,
      description: studio.description,
      rules: studio.rules.split("\n").filter(Boolean),
      status: mapProfileStatus(studio.status),
      halls: studio.halls.map((hall) => ({
        id: hall.id,
        name: hall.name,
        capacity: hall.capacity,
        pricePerHour: hall.hourlyRate,
        amenities: Array.isArray(hall.amenities) ? (hall.amenities as string[]) : [],
        status: hall.status === "ACTIVE" ? "Active" : "Inactive",
        imageUrl: hall.imageUrl,
        imagePublicId: hall.imagePublicId ?? undefined
      }))
    };
  } catch {
    return mockStudioProfile;
  }
}

export async function getOrCreateStudioProfileByOwnerId(ownerId: string): Promise<StudioProfile> {
  if (!canUseDatabase()) {
    return (await getDevStore()).studioProfile;
  }

  const existing = await prisma.studioProfile.findFirst({
    where: { ownerId },
    include: studioInclude,
    orderBy: { createdAt: "asc" }
  });

  if (existing) {
    return {
      id: existing.id,
      studioId: existing.id,
      name: existing.name,
      city: existing.city,
      address: existing.address,
      imageUrl: existing.imageUrl ?? undefined,
      imagePublicId: existing.imagePublicId ?? undefined,
      description: existing.description,
      rules: existing.rules.split("\n").filter(Boolean),
      status: mapProfileStatus(existing.status),
      halls: existing.halls.map(mapHall)
    };
  }

  const user = await prisma.user.findUnique({ where: { id: ownerId } });
  const created = await prisma.studioProfile.create({
    data: {
      ownerId,
      name: `${user?.name ?? "New"} Studio`,
      city: "Алматы",
      address: "Заполните адрес студии",
      description: "Заполните описание студии.",
      rules: "Заполните правила аренды",
      status: "DRAFT"
    },
    include: studioInclude
  });

  return {
    id: created.id,
    studioId: created.id,
    name: created.name,
    city: created.city,
    address: created.address,
    imageUrl: created.imageUrl ?? undefined,
    imagePublicId: created.imagePublicId ?? undefined,
    description: created.description,
    rules: created.rules.split("\n").filter(Boolean),
    status: "Draft",
    halls: []
  };
}

export async function getStudioHalls(studioId: string) {
  if (!canUseDatabase()) {
    return (await getDevStore()).studioProfile.halls;
  }

  try {
    const halls = await prisma.studioHall.findMany({
      where: { studioId },
      orderBy: { name: "asc" }
    });
    return halls.map(mapHall);
  } catch {
    return getMockStudioById(studioId)?.halls ?? [];
  }
}

export async function getStudioAvailabilitySlots(
  studioId: string
): Promise<DashboardAvailabilitySlot[]> {
  if (!canUseDatabase()) {
    return (await getDevStore()).studioSlots;
  }

  const slots = await prisma.availabilitySlot.findMany({
    where: {
      studioHall: {
        studioId
      }
    },
    include: {
      studioHall: true
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }]
  });

  return slots.map((slot) => ({
    id: slot.id,
    date: slot.date.toISOString().slice(0, 10),
    startTime: slot.startTime,
    endTime: slot.endTime,
    isAvailable: slot.isAvailable,
    studioHallId: slot.studioHallId ?? undefined,
    studioHallName: slot.studioHall?.name
  }));
}

function mapProfileStatus(status: string): StudioProfile["status"] {
  const map: Record<string, StudioProfile["status"]> = {
    DRAFT: "Draft",
    PUBLISHED: "Published",
    BLOCKED: "Blocked"
  };
  return map[status] ?? "Draft";
}

function mapHall(hall: {
  id: string;
  name: string;
  capacity: number;
  hourlyRate: number;
  imageUrl: string;
  imagePublicId?: string | null;
  amenities: unknown;
  status: string;
}): StudioHall {
  return {
    id: hall.id,
    name: hall.name,
    capacity: hall.capacity,
    pricePerHour: hall.hourlyRate,
    amenities: Array.isArray(hall.amenities) ? (hall.amenities as string[]) : [],
    status: hall.status === "ACTIVE" ? "Active" : "Inactive",
    imageUrl: hall.imageUrl,
    imagePublicId: hall.imagePublicId ?? undefined
  };
}
