import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { revalidateTag, unstable_cache } from "next/cache";
import { mockPhotographerProfile } from "@/lib/mock-data";
import { canUseDatabase } from "@/lib/data/db";
import { getDevStore } from "@/lib/data/dev-store";
import {
  mapPhotographer,
  mapPhotographerServices,
  mapSlots
} from "@/lib/data/mappers";
import {
  isMissingPhotographerServiceSchema,
  rethrowUnexpectedDatabaseError
} from "@/lib/data/photographer-services-rollout";
import type {
  DashboardAvailabilitySlot,
  PhotographerProfile,
  PhotographerReview,
  PortfolioItem
} from "@/lib/types";

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
const publicPhotographersCacheTag = "public-photographers";

const publicPhotographerUserWhere = {
  role: "PHOTOGRAPHER",
  // Phone and Telegram registrations do not have an email. `notIn` alone
  // filters NULL values out in PostgreSQL, hiding those real profiles.
  OR: [{ email: null }, { email: { notIn: demoPhotographerEmails } }]
} satisfies Prisma.UserWhereInput;

function getPublicPhotographerCacheTag(id: string) {
  return `public-photographer:${id}`;
}

function getPublicAlbumCacheTag(id: string) {
  return `public-photographer-album:${id}`;
}

export function revalidatePhotographerPublicData(
  photographerId: string,
  albumIds: string[] = []
) {
  revalidateTag(publicPhotographersCacheTag, { expire: 0 });
  revalidateTag(getPublicPhotographerCacheTag(photographerId), { expire: 0 });
  albumIds.forEach((albumId) =>
    revalidateTag(getPublicAlbumCacheTag(albumId), { expire: 0 })
  );
}

const photographerInclude = {
  styles: true,
  portfolioItems: {
    include: {
      albumImages: {
        orderBy: { sortOrder: "asc" as const }
      }
    }
  },
  availabilitySlots: true,
  reviews: {
    select: {
      rating: true
    }
  },
  services: {
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }]
  }
};

const getCachedPublicPhotographers = unstable_cache(
  async (style: string, city: string) => {
    const photographers = await prisma.photographerProfile.findMany({
      where: {
        status: "PUBLISHED",
        city: city || undefined,
        user: publicPhotographerUserWhere,
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
        reviews: {
          select: {
            rating: true
          }
        },
        styles: {
          select: {
            slug: true,
            name: true
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
        },
        services: {
          where: { isActive: true },
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            durationMinutes: true,
            included: true,
            isActive: true,
            sortOrder: true
          },
          orderBy: [{ price: "asc" }, { sortOrder: "asc" }]
        }
      },
      orderBy: { rating: "desc" }
    });

    return photographers.map(mapPhotographer).sort((a, b) => b.rating - a.rating);
  },
  ["public-photographers-v4"],
  { revalidate: 30, tags: [publicPhotographersCacheTag] }
);

export async function getPhotographers(filters: PhotographerFilters = {}) {
  if (!canUseDatabase()) {
    return [];
  }

  try {
    return await getCachedPublicPhotographers(filters.style ?? "", filters.city ?? "");
  } catch (error) {
    if (isMissingPhotographerServiceSchema(error)) {
      return [];
    }
    return rethrowUnexpectedDatabaseError("Failed to load public photographers", error);
  }
}

function getCachedPublicPhotographerPageData(id: string) {
  return unstable_cache(
  async () => {
    const profile = await prisma.photographerProfile.findFirst({
      where: {
        id,
        status: "PUBLISHED",
        user: publicPhotographerUserWhere
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
            slug: true,
            name: true
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
        },
        reviews: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            clientName: true,
            booking: {
              select: {
                clientName: true,
                client: {
                  select: {
                    name: true
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 24
        },
        services: {
          where: { isActive: true },
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            durationMinutes: true,
            included: true,
            isActive: true,
            sortOrder: true
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      }
    });

    if (!profile) {
      return undefined;
    }

    return {
      photographer: mapPhotographer(profile),
      portfolioItems: profile.portfolioItems.map(mapPortfolioItem),
      slots: mapSlots(profile.availabilitySlots),
      reviews: profile.reviews.map(mapPhotographerReview)
    };
  },
    ["public-photographer-page-v6", id],
    { revalidate: 30, tags: [getPublicPhotographerCacheTag(id)] }
  )();
}

export async function getPublicPhotographerPageData(id: string) {
  if (!canUseDatabase()) {
    return undefined;
  }

  try {
    return await getCachedPublicPhotographerPageData(id);
  } catch (error) {
    if (isMissingPhotographerServiceSchema(error)) {
      return undefined;
    }
    return rethrowUnexpectedDatabaseError("Failed to load public photographer page", error);
  }
}

function mapPhotographerReview(review: {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  clientName: string | null;
  booking: {
    clientName: string;
    client: { name: string } | null;
  } | null;
}): PhotographerReview {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment ?? undefined,
    createdAt: review.createdAt.toISOString(),
    clientName: review.clientName ?? review.booking?.client?.name ?? review.booking?.clientName ?? "Клиент"
  };
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
        user: publicPhotographerUserWhere
      },
      include: photographerInclude
    });
    return photographer ? mapPhotographer(photographer) : undefined;
  } catch (error) {
    if (isMissingPhotographerServiceSchema(error)) {
      return undefined;
    }
    return rethrowUnexpectedDatabaseError("Failed to load photographer", error);
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
        user: publicPhotographerUserWhere
      },
      include: photographerInclude
    });
    return photographer ? mapPhotographer(photographer) : undefined;
  } catch (error) {
    if (isMissingPhotographerServiceSchema(error)) {
      return undefined;
    }
    return rethrowUnexpectedDatabaseError("Failed to load photographer for booking", error);
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
      rating: getAverageReviewRating(profile.reviews),
      portfolio: profile.portfolioItems.map((item) => item.imageUrl),
      services: mapPhotographerServices(profile.services)
    };
  } catch (error) {
    if (isMissingPhotographerServiceSchema(error)) {
      return mockPhotographerProfile;
    }
    return rethrowUnexpectedDatabaseError("Failed to load photographer dashboard profile", error);
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
      rating: getAverageReviewRating(existing.reviews),
      portfolio: existing.portfolioItems.map((item) => item.imageUrl),
      services: mapPhotographerServices(existing.services)
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
    rating: getAverageReviewRating(created.reviews),
    portfolio: [],
    services: []
  };
}

function getAverageReviewRating(reviews?: Array<{ rating: number }>) {
  if (!reviews?.length) return 0;
  const average = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  return Number(average.toFixed(1));
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
    coverCropX: item.coverCropX ?? undefined,
    coverCropY: item.coverCropY ?? undefined,
    coverCropWidth: item.coverCropWidth ?? undefined,
    coverCropHeight: item.coverCropHeight ?? undefined,
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
        user: publicPhotographerUserWhere
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
    coverCropX: item.coverCropX ?? undefined,
    coverCropY: item.coverCropY ?? undefined,
    coverCropWidth: item.coverCropWidth ?? undefined,
    coverCropHeight: item.coverCropHeight ?? undefined,
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

function getCachedPublicAlbumPageData(
  photographerId: string,
  portfolioItemId: string
) {
  return unstable_cache(
  async () => {
    const item = await prisma.photographerPortfolioItem.findFirst({
      where: {
        id: portfolioItemId,
        photographerId,
        photographer: {
          status: "PUBLISHED",
          user: publicPhotographerUserWhere
        }
      },
      select: {
        id: true,
        imageUrl: true,
        imagePublicId: true,
        coverCropX: true,
        coverCropY: true,
        coverCropWidth: true,
        coverCropHeight: true,
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
    ["public-photographer-album-v3", photographerId, portfolioItemId],
    {
      revalidate: 30,
      tags: [
        getPublicPhotographerCacheTag(photographerId),
        getPublicAlbumCacheTag(portfolioItemId)
      ]
    }
  )();
}

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

export function mapPortfolioItem(item: {
  id: string;
  imageUrl: string;
  imagePublicId: string | null;
  coverCropX: number | null;
  coverCropY: number | null;
  coverCropWidth: number | null;
  coverCropHeight: number | null;
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
    coverCropX: item.coverCropX ?? undefined,
    coverCropY: item.coverCropY ?? undefined,
    coverCropWidth: item.coverCropWidth ?? undefined,
    coverCropHeight: item.coverCropHeight ?? undefined,
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
