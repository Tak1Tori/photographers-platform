import { prisma } from "@/lib/prisma";
import {
  getPhotographerById as getMockPhotographerById,
  mockPhotographerProfile,
  photographers as mockPhotographers
} from "@/lib/mock-data";
import { canUseDatabase } from "@/lib/data/db";
import { getDevStore } from "@/lib/data/dev-store";
import { mapPhotographer } from "@/lib/data/mappers";
import { mapSlots } from "@/lib/data/mappers";
import type { DashboardAvailabilitySlot, PhotographerProfile, PortfolioItem } from "@/lib/types";

interface PhotographerFilters {
  style?: string;
  city?: string;
}

const photographerInclude = {
  styles: true,
  portfolioItems: true,
  availabilitySlots: true
};

export async function getPhotographers(filters: PhotographerFilters = {}) {
  if (!canUseDatabase()) {
    return mockPhotographers.filter((photographer) =>
      filters.style ? photographer.specializationIds.includes(filters.style) : true
    );
  }

  try {
    const photographers = await prisma.photographerProfile.findMany({
      where: {
        status: "PUBLISHED",
        city: filters.city,
        styles: filters.style
          ? {
              some: {
                slug: filters.style
              }
            }
          : undefined
      },
      include: photographerInclude,
      orderBy: { rating: "desc" }
    });
    return photographers.length > 0
      ? photographers.map(mapPhotographer)
      : mockPhotographers.filter((photographer) =>
          filters.style ? photographer.specializationIds.includes(filters.style) : true
        );
  } catch {
    return mockPhotographers.filter((photographer) =>
      filters.style ? photographer.specializationIds.includes(filters.style) : true
    );
  }
}

export async function getPhotographerById(id?: string) {
  if (!id) {
    return undefined;
  }

  if (!canUseDatabase()) {
    return getMockPhotographerById(id);
  }

  try {
    const photographer = await prisma.photographerProfile.findUnique({
      where: { id },
      include: photographerInclude
    });
    return photographer ? mapPhotographer(photographer) : getMockPhotographerById(id);
  } catch {
    return getMockPhotographerById(id);
  }
}

export async function getPhotographerForBooking(id?: string) {
  if (!id) {
    return undefined;
  }

  if (!canUseDatabase()) {
    return getMockPhotographerById(id);
  }

  try {
    const photographer = await prisma.photographerProfile.findFirst({
      where: { id, status: "PUBLISHED" },
      include: photographerInclude
    });
    return photographer ? mapPhotographer(photographer) : undefined;
  } catch {
    return getMockPhotographerById(id);
  }
}

export async function getPhotographerProfileByUserId(userId: string): Promise<PhotographerProfile> {
  if (!canUseDatabase()) {
    return (await getDevStore()).photographerProfile;
  }

  try {
    const profile = await prisma.photographerProfile.findUnique({
      where: { userId },
      include: photographerInclude
    });

    if (!profile) {
      return mockPhotographerProfile;
    }

    return {
      id: profile.id,
      photographerId: profile.id,
      name: profile.name,
      city: profile.city,
      avatarUrl: profile.avatarUrl,
      avatarPublicId: profile.avatarPublicId ?? undefined,
      specializationIds: profile.styles.map((style) => style.slug),
      pricePerHour: profile.hourlyRate,
      bio: profile.bio,
      status: mapProfileStatus(profile.status),
      rating: profile.rating,
      portfolio: profile.portfolioItems.map((item) => item.imageUrl)
    };
  } catch {
    return mockPhotographerProfile;
  }
}

export async function getOrCreatePhotographerProfileByUserId(
  userId: string
): Promise<PhotographerProfile> {
  if (!canUseDatabase()) {
    return (await getDevStore()).photographerProfile;
  }

  const existing = await prisma.photographerProfile.findUnique({
    where: { userId },
    include: photographerInclude
  });

  if (existing) {
    return {
      id: existing.id,
      photographerId: existing.id,
      name: existing.name,
      city: existing.city,
      avatarUrl: existing.avatarUrl,
      avatarPublicId: existing.avatarPublicId ?? undefined,
      specializationIds: existing.styles.map((style) => style.slug),
      pricePerHour: existing.hourlyRate,
      bio: existing.bio,
      status: mapProfileStatus(existing.status),
      rating: existing.rating,
      portfolio: existing.portfolioItems.map((item) => item.imageUrl)
    };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const created = await prisma.photographerProfile.create({
    data: {
      userId,
      name: user?.name ?? "Новый фотограф",
      city: "Алматы",
      bio: "Заполните описание профиля.",
      avatarUrl:
        "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80",
      hourlyRate: 0,
      status: "DRAFT"
    },
    include: photographerInclude
  });

  return {
    id: created.id,
    photographerId: created.id,
    name: created.name,
    city: created.city,
    avatarUrl: created.avatarUrl,
    specializationIds: [],
    pricePerHour: created.hourlyRate,
    bio: created.bio,
    status: "Draft",
    rating: created.rating,
    portfolio: []
  };
}

export async function getPortfolioItems(photographerId: string): Promise<PortfolioItem[]> {
  if (!canUseDatabase()) {
    return (await getDevStore()).portfolioItems;
  }

  const items = await prisma.photographerPortfolioItem.findMany({
    where: { photographerId },
    orderBy: { createdAt: "desc" }
  });

  return items.map((item) => ({
    id: item.id,
    imageUrl: item.imageUrl,
    imagePublicId: item.imagePublicId ?? undefined,
    title: item.title ?? "",
    description: item.description ?? ""
  }));
}

export async function getPhotographerAvailabilitySlots(
  photographerId: string
): Promise<DashboardAvailabilitySlot[]> {
  if (!canUseDatabase()) {
    return (await getDevStore()).photographerSlots;
  }

  const slots = await prisma.availabilitySlot.findMany({
    where: { photographerId },
    orderBy: [{ date: "asc" }, { startTime: "asc" }]
  });

  return slots.map((slot) => ({
    id: slot.id,
    date: slot.date.toISOString().slice(0, 10),
    startTime: slot.startTime,
    endTime: slot.endTime,
    isAvailable: slot.isAvailable
  }));
}

export async function getPhotographersByStyle(styleSlug: string) {
  return getPhotographers({ style: styleSlug });
}

export async function getPhotographerSlots(photographerId: string) {
  if (!canUseDatabase()) {
    return [];
  }

  try {
    const slots = await prisma.availabilitySlot.findMany({
      where: { photographerId, isAvailable: true },
      orderBy: [{ date: "asc" }, { startTime: "asc" }]
    });
    return mapSlots(slots);
  } catch {
    return [];
  }
}

function mapProfileStatus(status: string): PhotographerProfile["status"] {
  const map: Record<string, PhotographerProfile["status"]> = {
    DRAFT: "Draft",
    PUBLISHED: "Published",
    BLOCKED: "Blocked"
  };
  return map[status] ?? "Draft";
}
