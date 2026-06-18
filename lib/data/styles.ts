import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { getStyleById as getMockStyleById, styles as mockStyles } from "@/lib/mock-data";
import { canUseDatabase } from "@/lib/data/db";
import { mapStyle } from "@/lib/data/mappers";

const getCachedStyles = unstable_cache(
  async () => {
    const styles = await prisma.style.findMany({ orderBy: { name: "asc" } });
    return styles.map(mapStyle);
  },
  ["public-styles-v1"],
  { revalidate: 30 }
);

const getCachedStyleBySlug = unstable_cache(
  async (slug: string) => {
    const style = await prisma.style.findUnique({ where: { slug } });
    return style ? mapStyle(style) : undefined;
  },
  ["public-style-by-slug-v1"],
  { revalidate: 30 }
);

export async function getStyles() {
  if (!canUseDatabase()) {
    return mockStyles;
  }

  try {
    const styles = await getCachedStyles();
    return styles.length > 0 ? styles : mockStyles;
  } catch {
    return mockStyles;
  }
}

export async function getStyleBySlug(slug?: string) {
  if (!slug) {
    return undefined;
  }

  if (!canUseDatabase()) {
    return getMockStyleById(slug);
  }

  try {
    return (await getCachedStyleBySlug(slug)) ?? getMockStyleById(slug);
  } catch {
    return getMockStyleById(slug);
  }
}
