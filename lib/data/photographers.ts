import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { mockPhotographerProfile } from "@/lib/mock-data";
import { canUseDatabase } from "@/lib/data/db";
import { getDevStore } from "@/lib/data/dev-store";
import { mapPhotographer } from "@/lib/data/mappers";
import { mapSlots } from "@/lib/data/mappers";
import type { DashboardAvailabilitySlot, PhotographerProfile, PortfolioItem } from "@/lib/types";

interface PhotographerFilters {
  style?: string;
  city?: string;
}

const demoPhotographerEmails = [
  "photographer@photo-booking.local",
  "timur@example.com",
  "maya@example.com",
  "daniyar@example.com",
  "leila@example.com"
];

const photographerInclude = {
  styles: true,
  portfolioItems: {
    include: {
      albumImages: {
        orderBy: { sortOrder: "asc" as const }
      }
    }
  },
  availabilitySlots: true
};

const getCachedPublicPhotographers = unstable_cache(
  async (style: string, city: string) => {
    const photographers = await prisma.photographerProfile.findMany({
      where: {
        status: "PUBLISHED",
        city: city || undefined,
        user: {
          email: {
            notIn: demoPhotographerEmails
          }
        },
        styles: style
          ? {
              some: {
                slug: style
              }
            }
          : undefined
      },
      select: {
        id: true,
        name: true,
        city: true,
        bio: true,
        avatarUrl: true,
        hourlyRate: true,
        rating: true,
        styles: {
          select: {
            slug: true
          }
        },
        portfolioItems: {
          select: {
            imageUrl: true
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 4
        }
      },
      orderBy: { rating: "desc" }
    });

    return photographers.map(mapPhotographer);
  },
  ["public-photographers-v1"],
  { revalidate: 30 }
);

export async function getPhotographers(filters: PhotographerFilters = {}) {
  if (!canUseDatabase()) {
    return [];
  }

  try {
    return getCachedPublicPhotographers(filters.style ?? "", filters.city ?? "");
  } catch {
    return [];
  }
}

const getCachedPublicPhotographerPageData = unstable_cache(
  async (id: string) => {
    const profile = await prisma.photographerProfile.findFirst({
      where: {
        id,
        status: "PUBLISHED",
        user: {
          email: {
            notIn: demoPhotographerEmails
          }
        }
      },
      select: {
        id: true,
        name: true,
        city: true,
        bio: true,
        avatarUrl: true,
        hourlyRate: true,
        rating: true,
        styles: {
          select: {
            slug: true
          }
        },
        portfolioItems: {
          include: {
            albumImages: {
              orderBy: {
                sortOrder: "asc"
              }
            }
          },
          orderBy: {
            createdAt: "desc"
          }
        },
        availabilitySlots: {
          where: {
            isAvailable: true
          },
          orderBy: [{ date: "asc" }, { startTime: "asc" }]
        }
      }
    });

    if (!profile) {
      return undefined;
    }

    return {
      photographer: mapPhotographer(profile),
      portfolioItems: profile.portfolioItems.map(mapPortfolioItem),
      slots: mapSlots(profile.availabilitySlots)
    };
  },
  ["public-photographer-page-v1"],
  { revalidate: 30 }
);

export async function getPublicPhotographerPageData(id: string) {
  if (!canUseDatabase()) {
    return undefined;
  }

  try {
    return await getCachedPublicPhotographerPageData(id);
  } catch {
    return undefined;
  }
}

export async function getPhotographerById(id?: string) {
  if (!id) {
    return undefined;
  }

  if (!canUseDatabase()) {
    return undefined;
  }

  try {
    const photographer = await prisma.photographerProfile.findFirst({
      where: {
        id,
        status: "PUBLISHED",
        user: {
          email: {
            notIn: demoPhotographerEmails
          }
        }
      },
      include: photographerInclude
    });
    return photographer ? mapPhotographer(photographer) : undefined;
  } catch {
    return undefined;
  }
}

export async function getPhotographerForBooking(id?: string) {
  if (!id) {
    return undefined;
  }

  if (!canUseDatabase()) {
    return undefined;
  }

  try {
    const photographer = await prisma.photographerProfile.findFirst({
      where: {
        id,
        status: "PUBLISHED",
        user: {
          email: {
            notIn: demoPhotographerEmails
          }
        }
      },
      include: photographerInclude
    });
    return photographer ? mapPhotographer(photographer) : undefined;
  } catch {
    return undefined;
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
    include: {
      albumImages: {
        orderBy: { sortOrder: "asc" }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return items.map((item) => ({
    id: item.id,
    imageUrl: item.imageUrl,
    imagePublicId: item.imagePublicId ?? undefined,
    title: item.title ?? "",
    description: item.description ?? "",
    albumImages: item.albumImages.map((image) => ({
      id: image.id,
      imageUrl: image.imageUrl,
      imagePublicId: image.imagePublicId ?? undefined,
      mediaType: image.mediaType,
      sortOrder: image.sortOrder
    }))
  }));
}

export async function getPublicPortfolioItem(
  photographerId: string,
  portfolioItemId: string
): Promise<PortfolioItem | undefined> {
  if (!canUseDatabase()) {
    return undefined;
  }

  const item = await prisma.photographerPortfolioItem.findFirst({
    where: {
      id: portfolioItemId,
      photographerId,
      photographer: {
        status: "PUBLISHED",
        user: {
          email: {
            notIn: demoPhotographerEmails
          }
        }
      }
    },
    include: {
      albumImages: {
        orderBy: { sortOrder: "asc" }
      }
    }
  });

  if (!item) {
    return undefined;
  }

  return {
    id: item.id,
    imageUrl: item.imageUrl,
    imagePublicId: item.imagePublicId ?? undefined,
    title: item.title ?? "",
    description: item.description ?? "",
    albumImages: item.albumImages.map((image) => ({
      id: image.id,
      imageUrl: image.imageUrl,
      imagePublicId: image.imagePublicId ?? undefined,
      mediaType: image.mediaType,
      sortOrder: image.sortOrder
    }))
  };
}

const getCachedPublicAlbumPageData = unstable_cache(
  async (photographerId: string, portfolioItemId: string) => {
    const item = await prisma.photographerPortfolioItem.findFirst({
      where: {
        id: portfolioItemId,
        photographerId,
        photographer: {
          status: "PUBLISHED",
          user: {
            email: {
              notIn: demoPhotographerEmails
            }
          }
        }
      },
      select: {
        id: true,
        imageUrl: true,
        imagePublicId: true,
        title: true,
        description: true,
        photographer: {
          select: {
            id: true,
            name: true
          }
        },
        albumImages: {
          orderBy: {
            sortOrder: "asc"
          }
        }
      }
    });

    if (!item) {
      return undefined;
    }

    return {
      photographer: item.photographer,
      album: mapPortfolioItem(item)
    };
  },
  ["public-photographer-album-v2"],
  { revalidate: 30 }
);

export async function getPublicAlbumPageData(
  photographerId: string,
  portfolioItemId: string
) {
  if (!canUseDatabase()) {
    return undefined;
  }

  try {
    return await getCachedPublicAlbumPageData(photographerId, portfolioItemId);
  } catch {
    return undefined;
  }
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

function mapPortfolioItem(item: {
  id: string;
  imageUrl: string;
  imagePublicId: string | null;
  title: string | null;
  description: string | null;
  albumImages: Array<{
    id: string;
    imageUrl: string;
    imagePublicId: string | null;
    mediaType: "IMAGE" | "VIDEO";
    sortOrder: number;
  }>;
}): PortfolioItem {
  return {
    id: item.id,
    imageUrl: item.imageUrl,
    imagePublicId: item.imagePublicId ?? undefined,
    title: item.title ?? "",
    description: item.description ?? "",
    albumImages: item.albumImages.map((image) => ({
      id: image.id,
      imageUrl: image.imageUrl,
      imagePublicId: image.imagePublicId ?? undefined,
      mediaType: resolveAlbumMediaType(image.mediaType, image.imageUrl),
      sortOrder: image.sortOrder
    }))
  };
}

function resolveAlbumMediaType(
  mediaType: "IMAGE" | "VIDEO" | undefined,
  imageUrl: string
): "IMAGE" | "VIDEO" {
  if (mediaType === "VIDEO") return "VIDEO";

  const pathname = imageUrl.split(/[?#]/, 1)[0].toLowerCase();
  return /\.(mp4|webm|mov|m4v)$/.test(pathname) ? "VIDEO" : "IMAGE";
}
