import { prisma } from "@/lib/prisma";
import { getStyleById as getMockStyleById, styles as mockStyles } from "@/lib/mock-data";
import { canUseDatabase } from "@/lib/data/db";
import { mapStyle } from "@/lib/data/mappers";

export async function getStyles() {
  if (!canUseDatabase()) {
    return mockStyles;
  }

  try {
    const styles = await prisma.style.findMany({ orderBy: { name: "asc" } });
    return styles.length > 0 ? styles.map(mapStyle) : mockStyles;
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
    const style = await prisma.style.findUnique({ where: { slug } });
    return style ? mapStyle(style) : getMockStyleById(slug);
  } catch {
    return getMockStyleById(slug);
  }
}
