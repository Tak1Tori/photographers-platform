import { revalidateTag, unstable_cache } from "next/cache";
import { canUseDatabase } from "@/lib/data/db";
import { mapPhotographer, mapSlots } from "@/lib/data/mappers";
import { mapPortfolioItem } from "@/lib/data/photographers";
import { prisma } from "@/lib/prisma";
import type { Photographer, PhotographerReview } from "@/lib/types";

type EditorFilters = {
  tag?: string;
};

export type EditorTagOption = {
  id: string;
  title: string;
};

const publicEditorsCacheTag = "public-editors";

function getEditorCacheTag(id: string) {
  return `public-editor:${id}`;
}

function mapEditor(profile: Parameters<typeof mapPhotographer>[0] & { editorTags: Array<{ slug: string; name: string }> }) {
  return mapPhotographer({ ...profile, styles: profile.editorTags });
}

function mapReview(review: {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  clientName: string | null;
  booking: { clientName: string; client: { name: string } | null } | null;
}): PhotographerReview {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment ?? undefined,
    createdAt: review.createdAt.toISOString(),
    clientName: review.clientName ?? review.booking?.client?.name ?? review.booking?.clientName ?? "Клиент"
  };
}

const getCachedEditors = unstable_cache(
  async (tag: string): Promise<Photographer[]> => {
    const profiles = await prisma.photographerProfile.findMany({
      where: {
        status: "PUBLISHED",
        user: { role: "EDITOR" },
        editorTags: tag ? { some: { slug: tag } } : undefined
      },
      select: {
        id: true,
        name: true,
        city: true,
        bio: true,
        avatarUrl: true,
        hourlyRate: true,
        rating: true,
        editorTags: { select: { slug: true, name: true } },
        reviews: { select: { rating: true } },
        portfolioItems: {
          select: { imageUrl: true },
          orderBy: { createdAt: "desc" },
          take: 4
        }
      },
      orderBy: { rating: "desc" }
    });

    return profiles.map(mapEditor).sort((a, b) => b.rating - a.rating);
  },
  ["public-editors-v1"],
  { revalidate: 30, tags: [publicEditorsCacheTag] }
);

const getCachedEditorTags = unstable_cache(
  async (): Promise<EditorTagOption[]> => {
    const tags = await prisma.editorTag.findMany({ orderBy: { name: "asc" } });
    return tags.map((tag) => ({ id: tag.slug, title: tag.name }));
  },
  ["public-editor-tags-v1"],
  { revalidate: 30, tags: [publicEditorsCacheTag] }
);

export async function getEditors(filters: EditorFilters = {}) {
  if (!canUseDatabase()) return [];

  try {
    return await getCachedEditors(filters.tag ?? "");
  } catch {
    return [];
  }
}

export async function getEditorTags() {
  if (!canUseDatabase()) return [];

  try {
    return await getCachedEditorTags();
  } catch {
    return [];
  }
}

function getCachedEditorPageData(id: string) {
  return unstable_cache(
    async () => {
      const profile = await prisma.photographerProfile.findFirst({
        where: {
          id,
          status: "PUBLISHED",
          user: { role: "EDITOR" }
        },
        select: {
          id: true,
          name: true,
          city: true,
          bio: true,
          avatarUrl: true,
          hourlyRate: true,
          rating: true,
          editorTags: { select: { slug: true, name: true } },
          portfolioItems: {
            include: { albumImages: { orderBy: { sortOrder: "asc" } } },
            orderBy: { createdAt: "desc" }
          },
          availabilitySlots: {
            where: { isAvailable: true },
            orderBy: [{ date: "asc" }, { startTime: "asc" }]
          },
          reviews: {
            select: {
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
              clientName: true,
              booking: { select: { clientName: true, client: { select: { name: true } } } }
            },
            orderBy: { createdAt: "desc" },
            take: 24
          }
        }
      });

      if (!profile) return undefined;

      return {
        editor: mapEditor(profile),
        portfolioItems: profile.portfolioItems.map(mapPortfolioItem),
        slots: mapSlots(profile.availabilitySlots),
        reviews: profile.reviews.map(mapReview)
      };
    },
    ["public-editor-page-v1", id],
    { revalidate: 30, tags: [getEditorCacheTag(id)] }
  )();
}

export async function getPublicEditorPageData(id: string) {
  if (!canUseDatabase()) return undefined;

  try {
    return await getCachedEditorPageData(id);
  } catch {
    return undefined;
  }
}

function getCachedEditorAlbumPageData(editorId: string, albumId: string) {
  return unstable_cache(
    async () => {
      const item = await prisma.photographerPortfolioItem.findFirst({
        where: {
          id: albumId,
          photographerId: editorId,
          photographer: { status: "PUBLISHED", user: { role: "EDITOR" } }
        },
        include: {
          photographer: {
            select: {
              id: true,
              name: true,
              city: true,
              bio: true,
              avatarUrl: true,
              hourlyRate: true,
              rating: true,
              editorTags: { select: { slug: true, name: true } },
              reviews: { select: { rating: true } }
            }
          },
          albumImages: { orderBy: { sortOrder: "asc" } }
        }
      });

      if (!item) return undefined;

      return {
        editor: mapEditor(item.photographer),
        album: mapPortfolioItem(item)
      };
    },
    ["public-editor-album-v1", editorId, albumId],
    { revalidate: 30, tags: [getEditorCacheTag(editorId)] }
  )();
}

export async function getPublicEditorAlbumPageData(editorId: string, albumId: string) {
  if (!canUseDatabase()) return undefined;

  try {
    return await getCachedEditorAlbumPageData(editorId, albumId);
  } catch {
    return undefined;
  }
}

export function revalidateEditorPublicData(editorId: string) {
  revalidateTag(publicEditorsCacheTag, { expire: 0 });
  revalidateTag(getEditorCacheTag(editorId), { expire: 0 });
}
