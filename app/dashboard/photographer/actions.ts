"use server";

import { BookingStatus, ProfileStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { canUseDatabase } from "@/lib/data/db";
import { getDevStore, updateDevStore } from "@/lib/data/dev-store";
import { revalidatePhotographerPublicData } from "@/lib/data/photographers";
import {
  notifyBookingStatusChanged,
  notifyFinalPaymentRequested
} from "@/lib/notifications/notification-service";
import { createFinalPaymentForBooking } from "@/lib/payments/payment-service";
import {
  cancelPlatformBookingEvent,
  createPlatformBookingEvent
} from "@/lib/calendar/calendar-service";
import { cancelBookingHolds } from "@/lib/calendar/hold-service";
import {
  assertCanMoveBookingToInProgress,
  autoCompletePastBookings
} from "@/lib/bookings/status-service";
import { prisma } from "@/lib/prisma";
import {
  avatarImageMaxBytes,
  albumCoverMaxBytes,
  albumImageMaxBytes,
  albumUploadMaxBytes,
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
  validateImageFile
} from "@/lib/uploads";
import { formatMegabytes } from "@/lib/upload-limits";
import { type CloudinaryUploadResult } from "@/lib/cloudinary";

const placeholderImage =
  "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80";

type ActionResult = { success: boolean; error?: string };
type MediaProviderValue = "CLOUDINARY" | "SUPABASE" | "LOCAL";
type UploadedAlbumMedia = {
  imageUrl: string;
  imagePublicId: string;
  mediaType: "IMAGE" | "VIDEO";
  provider?: MediaProviderValue;
  bytes?: number;
  originalBytes?: number;
  width?: number;
  height?: number;
  format?: string;
};
type AlbumMediaRecord = {
  id?: string;
  imageUrl: string;
  imagePublicId?: string | null;
  mediaType: "IMAGE" | "VIDEO";
  sortOrder?: number | null;
  provider?: string | null;
  bytes?: number | null;
  originalBytes?: number | null;
  width?: number | null;
  height?: number | null;
  format?: string | null;
};
type AlbumCoverCrop = {
  key: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  zoom?: number;
};

const customStyleImage =
  "https://images.unsplash.com/photo-1452780212940-6f5c0d14d848?auto=format&fit=crop&w=1200&q=80";

function inferMediaProvider(publicId?: string | null): MediaProviderValue | undefined {
  if (!publicId) return undefined;
  if (publicId.startsWith("cloudinary:")) return "CLOUDINARY";
  if (publicId.startsWith("supabase:")) return "SUPABASE";
  return undefined;
}

function cleanOptionalInt(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return Math.round(value);
}

function cleanOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function cleanMediaProvider(value: unknown): MediaProviderValue | undefined {
  return value === "CLOUDINARY" || value === "SUPABASE" || value === "LOCAL"
    ? value
    : undefined;
}

function getMediaMetadata(media: {
  imagePublicId?: string;
  provider?: MediaProviderValue;
  bytes?: number;
  originalBytes?: number;
  width?: number;
  height?: number;
  format?: string;
}) {
  return {
    provider: media.provider ?? inferMediaProvider(media.imagePublicId),
    bytes: cleanOptionalInt(media.bytes),
    originalBytes: cleanOptionalInt(media.originalBytes),
    width: cleanOptionalInt(media.width),
    height: cleanOptionalInt(media.height),
    format: cleanOptionalString(media.format)
  };
}

function cloudinaryResultToUploadedAlbumMedia(
  uploaded: CloudinaryUploadResult
): UploadedAlbumMedia {
  return {
    imageUrl: uploaded.secureUrl,
    imagePublicId: uploaded.publicId,
    mediaType: uploaded.mediaType,
    provider: uploaded.provider,
    bytes: uploaded.bytes,
    originalBytes: uploaded.originalBytes,
    width: uploaded.width,
    height: uploaded.height,
    format: uploaded.format
  };
}

function getAlbumImageData(media: UploadedAlbumMedia, sortOrder: number) {
  return {
    imageUrl: media.imageUrl,
    imagePublicId: media.imagePublicId,
    mediaType: media.mediaType,
    sortOrder,
    ...getMediaMetadata(media)
  };
}

function getAlbumMediaKey(media: {
  imagePublicId?: string | null;
  imageUrl?: string | null;
}) {
  return media.imagePublicId || media.imageUrl || "";
}

function uniqueUploadedAlbumMedia(media: UploadedAlbumMedia[]) {
  const seen = new Set<string>();

  return media.filter((item) => {
    const key = getAlbumMediaKey(item);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getRemainingAlbumMediaKeys(
  images: Array<{
    id?: string;
    imagePublicId?: string | null;
    imageUrl?: string | null;
  }>,
  removedIds: string[]
) {
  return new Set(
    images
      .filter((image) => !image.id || !removedIds.includes(image.id))
      .map(getAlbumMediaKey)
      .filter((key): key is string => Boolean(key))
  );
}

function getNewAlbumUploads(
  uploadedMedia: UploadedAlbumMedia[],
  existingKeys: Set<string>
) {
  return uniqueUploadedAlbumMedia(uploadedMedia).filter((media) => {
    const key = getAlbumMediaKey(media);
    return key && !existingKeys.has(key);
  });
}

function getPortfolioCoverMediaData(uploaded: CloudinaryUploadResult) {
  return {
    imageUrl: uploaded.secureUrl,
    imagePublicId: uploaded.publicId,
    mediaType: uploaded.mediaType,
    ...getMediaMetadata({
      imagePublicId: uploaded.publicId,
      provider: uploaded.provider,
      bytes: uploaded.bytes,
      originalBytes: uploaded.originalBytes,
      width: uploaded.width,
      height: uploaded.height,
      format: uploaded.format
    }),
    ...getCoverCropData()
  };
}

function getCoverCropData(crop?: AlbumCoverCrop | null) {
  if (!crop) {
    return {
      coverCropX: null,
      coverCropY: null,
      coverCropWidth: null,
      coverCropHeight: null
    };
  }

  const width = cleanCoverCropNumber(crop.width, 80, 10, 100);
  const height = cleanCoverCropNumber(crop.height, 45, 10, 100);

  return {
    coverCropX: clampNumber(crop.x, 0, 100 - width),
    coverCropY: clampNumber(crop.y, 0, 100 - height),
    coverCropWidth: width,
    coverCropHeight: height
  };
}

function getAlbumCoverMediaData(
  media: AlbumMediaRecord | null | undefined,
  crop?: AlbumCoverCrop | null
) {
  if (!media || media.mediaType !== "IMAGE") return null;

  return {
    imageUrl: media.imageUrl,
    imagePublicId: media.imagePublicId ?? undefined,
    mediaType: "IMAGE" as const,
    ...getMediaMetadata({
      imagePublicId: media.imagePublicId ?? undefined,
      provider: cleanMediaProvider(media.provider),
      bytes: media.bytes ?? undefined,
      originalBytes: media.originalBytes ?? undefined,
      width: media.width ?? undefined,
      height: media.height ?? undefined,
      format: media.format ?? undefined
    }),
    ...getCoverCropData(crop)
  };
}

function getSelectedAlbumCoverMediaData<T extends AlbumMediaRecord>(
  coverKey: string,
  media: T[],
  crop?: AlbumCoverCrop | null
) {
  if (!coverKey) return null;

  return getAlbumCoverMediaData(
    media.find((item) => getAlbumMediaKey(item) === coverKey),
    crop?.key === coverKey ? crop : null
  );
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function orderAlbumMedia<T extends AlbumMediaRecord>(
  media: T[],
  submittedOrder: string[]
) {
  const mediaByKey = new Map(
    media
      .map((item) => [getAlbumMediaKey(item), item] as const)
      .filter(([key]) => Boolean(key))
  );
  const ordered = submittedOrder
    .map((key) => mediaByKey.get(key))
    .filter((item): item is T => Boolean(item));
  const orderedKeys = new Set(ordered.map(getAlbumMediaKey));
  const rest = media
    .filter((item) => !orderedKeys.has(getAlbumMediaKey(item)))
    .sort((first, second) => (first.sortOrder ?? 0) - (second.sortOrder ?? 0));

  return [...ordered, ...rest];
}

function getAvatarMediaData(uploaded: CloudinaryUploadResult) {
  return {
    avatarUrl: uploaded.secureUrl,
    avatarPublicId: uploaded.publicId,
    avatarProvider: uploaded.provider,
    avatarBytes: uploaded.bytes,
    avatarOriginalBytes: uploaded.originalBytes,
    avatarWidth: uploaded.width,
    avatarHeight: uploaded.height,
    avatarFormat: uploaded.format,
    avatarMediaType: uploaded.mediaType
  };
}

async function requirePhotographerProfile() {
  const session = await getSession();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const allowedRoles: UserRole[] = [UserRole.PHOTOGRAPHER, UserRole.ADMIN];
  if (!allowedRoles.includes(session.user.role)) {
    throw new Error("Forbidden");
  }

  const profile = canUseDatabase()
    ? await prisma.photographerProfile.findUnique({
        where: { userId: session.user.id }
      })
    : (await getDevStore()).photographerProfile;

  if (!profile) {
    throw new Error("Photographer profile not found");
  }

  return { session, profile };
}

export async function createCustomPhotographerStyleAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { profile } = await requirePhotographerProfile();
    const name = String(formData.get("styleName") ?? "")
      .trim()
      .replace(/\s+/g, " ");

    if (name.length < 2 || name.length > 60) {
      return {
        success: false,
        error: "Название стиля должно содержать от 2 до 60 символов."
      };
    }

    if (!canUseDatabase()) {
      return {
        success: false,
        error: "Для добавления нового стиля требуется подключение к базе данных."
      };
    }

    await prisma.$transaction(async (transaction) => {
      let style = await transaction.style.findFirst({
        where: {
          name: {
            equals: name,
            mode: "insensitive"
          }
        },
        select: {
          id: true
        }
      });

      if (!style) {
        const baseSlug = slugifyStyleName(name);
        let slug = baseSlug;
        let suffix = 2;

        while (await transaction.style.findUnique({ where: { slug }, select: { id: true } })) {
          slug = `${baseSlug}-${suffix}`;
          suffix += 1;
        }

        style = await transaction.style.create({
          data: {
            name,
            slug,
            description: "Пользовательский стиль съемки",
            startingPrice:
              "hourlyRate" in profile ? profile.hourlyRate : profile.pricePerHour,
            imageUrl: customStyleImage
          },
          select: {
            id: true
          }
        });
      }

      await transaction.photographerProfile.update({
        where: { id: profile.id },
        data: {
          styles: {
            connect: { id: style.id }
          }
        }
      });
    });

    revalidatePath("/dashboard/photographer");
    revalidatePath("/photographers");
    revalidatePath(`/photographers/${profile.id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updatePhotographerProfileAction(formData: FormData): Promise<ActionResult> {
  let newAvatarPublicId: string | undefined;
  let newAvatarData: ReturnType<typeof getAvatarMediaData> | undefined;
  let avatarSaved = false;

  try {
    const { session, profile } = await requirePhotographerProfile();
    const name = String(formData.get("name") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const bio = String(formData.get("bio") ?? "").trim();
    const avatarFile = formData.get("avatar") as File | null;
    const hasNewAvatar = Boolean(avatarFile?.size);
    let avatarUrl = profile.avatarUrl || placeholderImage;
    const hourlyRate = Number(formData.get("hourlyRate") ?? 0);
    const styleSlugs = Array.from(
      new Set(
        formData
          .getAll("styleIds")
          .map(String)
          .map((slug) => slug.trim())
          .filter(Boolean)
      )
    );

    if (!name || !city || !bio) {
      return { success: false, error: "Заполните имя, город и описание." };
    }

    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
      return { success: false, error: "Цена за час должна быть положительным числом." };
    }

    if (hasNewAvatar && avatarFile) {
      const validation = validateImageFile(avatarFile, avatarImageMaxBytes);

      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const uploaded = await uploadImageToCloudinary(
        avatarFile,
        "photographers/avatars",
        avatarImageMaxBytes
      );
      newAvatarData = getAvatarMediaData(uploaded);
      avatarUrl = newAvatarData.avatarUrl;
      newAvatarPublicId = newAvatarData.avatarPublicId;
    }

    if (!canUseDatabase()) {
      const oldPublicId = "avatarPublicId" in profile ? profile.avatarPublicId : undefined;
      await updateDevStore((store) => ({
        ...store,
        photographerProfile: {
          ...store.photographerProfile,
          name,
          city,
          bio,
          avatarUrl,
          avatarPublicId: newAvatarPublicId ?? store.photographerProfile.avatarPublicId,
          ...(newAvatarData ?? {}),
          pricePerHour: hourlyRate,
          specializationIds: styleSlugs
        }
      }));
      avatarSaved = true;
      if (newAvatarPublicId) {
        await deleteImageQuietly(oldPublicId);
      }
      revalidatePath("/dashboard/photographer");
      revalidatePath("/photographers");
      return { success: true };
    }

    const existingStyles = await prisma.style.findMany({
      where: {
        slug: {
          in: styleSlugs
        }
      },
      select: {
        slug: true
      }
    });

    if (existingStyles.length !== styleSlugs.length) {
      return {
        success: false,
        error: "Некоторые выбранные стили больше недоступны. Обновите страницу и попробуйте снова."
      };
    }

    await prisma.$transaction([
      prisma.photographerProfile.update({
        where: { id: profile.id },
        data: {
          name,
          city,
          bio,
          avatarUrl,
          avatarPublicId:
            newAvatarPublicId ??
            ("avatarPublicId" in profile ? profile.avatarPublicId : undefined),
          ...(newAvatarData ?? {}),
          hourlyRate,
          styles: {
            set: existingStyles.map(({ slug }) => ({ slug }))
          }
        }
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: {
          name,
          image: avatarUrl
        }
      })
    ]);
    avatarSaved = true;

    if (newAvatarPublicId) {
      const oldPublicId = "avatarPublicId" in profile ? profile.avatarPublicId : undefined;
      await deleteImageQuietly(oldPublicId);
    }

    revalidatePath("/dashboard/photographer");
    revalidatePath("/photographers");
    revalidatePath(`/photographers/${profile.id}`);
    return { success: true };
  } catch (error) {
    if (newAvatarPublicId && !avatarSaved) {
      await deleteImageQuietly(newAvatarPublicId);
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function savePhotographerServiceAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile } = await requirePhotographerProfile();
    const service = parsePhotographerServiceForm(formData);

    if (service.error) {
      return { success: false, error: service.error };
    }

    const serviceId = String(formData.get("serviceId") ?? "").trim();

    if (!canUseDatabase()) {
      await updateDevStore((store) => {
        const services = [...store.photographerProfile.services];
        const existingIndex = services.findIndex((item) => item.id === serviceId);
        const next = {
          id: serviceId || `dev-service-${crypto.randomUUID()}`,
          ...service.data,
          description: service.data.description ?? undefined,
          sortOrder: existingIndex >= 0 ? services[existingIndex]!.sortOrder : services.length
        };

        if (existingIndex >= 0) services[existingIndex] = next;
        else services.push(next);

        return {
          ...store,
          photographerProfile: { ...store.photographerProfile, services }
        };
      });
      revalidatePath("/dashboard/photographer");
      return { success: true };
    }

    if (serviceId) {
      const existing = await prisma.photographerService.findFirst({
        where: { id: serviceId, photographerId: profile.id },
        select: { id: true }
      });
      if (!existing) return { success: false, error: "Услуга не найдена." };

      await prisma.photographerService.update({
        where: { id: existing.id },
        data: service.data
      });
    } else {
      const lastService = await prisma.photographerService.findFirst({
        where: { photographerId: profile.id },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true }
      });
      await prisma.photographerService.create({
        data: {
          photographerId: profile.id,
          ...service.data,
          sortOrder: (lastService?.sortOrder ?? -1) + 1
        }
      });
    }

    revalidatePhotographerServiceData(profile.id);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deletePhotographerServiceAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile } = await requirePhotographerProfile();
    const serviceId = String(formData.get("serviceId") ?? "").trim();
    if (!serviceId) return { success: false, error: "Услуга не выбрана." };

    if (!canUseDatabase()) {
      await updateDevStore((store) => ({
        ...store,
        photographerProfile: {
          ...store.photographerProfile,
          services: store.photographerProfile.services.filter((service) => service.id !== serviceId)
        }
      }));
      revalidatePath("/dashboard/photographer");
      return { success: true };
    }

    const deleted = await prisma.photographerService.deleteMany({
      where: { id: serviceId, photographerId: profile.id }
    });
    if (!deleted.count) return { success: false, error: "Услуга не найдена." };

    revalidatePhotographerServiceData(profile.id);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function movePhotographerServiceAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile } = await requirePhotographerProfile();
    const serviceId = String(formData.get("serviceId") ?? "").trim();
    const direction = String(formData.get("direction") ?? "");
    const shift = direction === "up" ? -1 : direction === "down" ? 1 : 0;
    if (!serviceId || !shift) return { success: false, error: "Не удалось изменить порядок услуги." };

    if (!canUseDatabase()) {
      await updateDevStore((store) => ({
        ...store,
        photographerProfile: {
          ...store.photographerProfile,
          services: movePhotographerService(store.photographerProfile.services, serviceId, shift)
        }
      }));
      revalidatePath("/dashboard/photographer");
      return { success: true };
    }

    const services = await prisma.photographerService.findMany({
      where: { photographerId: profile.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, sortOrder: true }
    });
    const index = services.findIndex((service) => service.id === serviceId);
    const targetIndex = index + shift;
    if (index < 0) return { success: false, error: "Услуга не найдена." };
    if (targetIndex < 0 || targetIndex >= services.length) return { success: true };

    const current = services[index]!;
    const target = services[targetIndex]!;
    await prisma.$transaction([
      prisma.photographerService.update({ where: { id: current.id }, data: { sortOrder: target.sortOrder } }),
      prisma.photographerService.update({ where: { id: target.id }, data: { sortOrder: current.sortOrder } })
    ]);

    revalidatePhotographerServiceData(profile.id);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

function parsePhotographerServiceForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim().replace(/\s+/g, " ");
  const description = String(formData.get("description") ?? "").trim();
  const price = Number(formData.get("price") ?? 0);
  const durationMinutes = Number(formData.get("durationMinutes") ?? 0);
  const included = Array.from(
    new Set(
      String(formData.get("included") ?? "")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 12);

  if (title.length < 2 || title.length > 100) {
    return { error: "Название услуги должно содержать от 2 до 100 символов." } as const;
  }
  if (description.length > 1000) {
    return { error: "Описание услуги не должно превышать 1000 символов." } as const;
  }
  if (!Number.isSafeInteger(price) || price < 1 || price > 10_000_000) {
    return { error: "Укажите стоимость услуги от 1 до 10 000 000 ₸." } as const;
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 12 * 60 || durationMinutes % 30 !== 0) {
    return { error: "Длительность должна быть от 30 минут до 12 часов с шагом 30 минут." } as const;
  }
  if (included.some((item) => item.length > 160)) {
    return { error: "Каждый пункт состава услуги не должен превышать 160 символов." } as const;
  }

  return {
    data: {
      title,
      description: description || null,
      price,
      durationMinutes,
      included,
      isActive: formData.get("isActive") === "on"
    }
  } as const;
}

function movePhotographerService<T extends { id: string; sortOrder: number }>(
  services: T[],
  serviceId: string,
  shift: number
) {
  const ordered = [...services].sort((first, second) => first.sortOrder - second.sortOrder);
  const index = ordered.findIndex((service) => service.id === serviceId);
  const targetIndex = index + shift;
  if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return ordered;
  [ordered[index], ordered[targetIndex]] = [ordered[targetIndex]!, ordered[index]!];
  return ordered.map((service, sortOrder) => ({ ...service, sortOrder }));
}

function revalidatePhotographerServiceData(photographerId: string) {
  revalidatePath("/dashboard/photographer");
  revalidatePhotographerPublicData(photographerId);
  revalidatePath("/photographers");
  revalidatePath(`/photographers/${photographerId}`);
}

export async function createPortfolioItemAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile } = await requirePhotographerProfile();
    const imageUrl = String(formData.get("imageUrl") ?? "").trim() || placeholderImage;
    const title = String(formData.get("title") ?? "").trim();
    const description = "";

    if (!canUseDatabase()) {
      await updateDevStore((store) => ({
        ...store,
        portfolioItems: [
          {
            id: `dev-portfolio-${Date.now()}`,
            imageUrl,
            title,
            description,
            albumImages: []
          },
          ...store.portfolioItems
        ],
        photographerProfile: {
          ...store.photographerProfile,
          portfolio: [imageUrl, ...store.photographerProfile.portfolio]
        }
      }));
      revalidatePath("/dashboard/photographer");
      revalidatePath("/photographers");
      return { success: true };
    }

    await prisma.photographerPortfolioItem.create({
      data: {
        photographerId: profile.id,
        imageUrl,
        title,
        description
      }
    });

    revalidatePath("/dashboard/photographer");
    revalidatePath("/photographers");
    revalidatePath(`/photographers/${profile.id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function createPortfolioItemWithUploadAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { profile } = await requirePhotographerProfile();
    const file = formData.get("image") as File | null;
    const title = String(formData.get("title") ?? "").trim();
    const description = "";
    const validation = validateImageFile(file, albumCoverMaxBytes);

    if (!validation.valid || !file) {
      return { success: false, error: validation.error };
    }

    const uploaded = await uploadImageToCloudinary(
      file,
      "photographers/portfolio",
      albumCoverMaxBytes
    );
    const imageData = getPortfolioCoverMediaData(uploaded);

    if (!canUseDatabase()) {
      await updateDevStore((store) => ({
        ...store,
        portfolioItems: [
          {
            id: `dev-portfolio-${Date.now()}`,
            ...imageData,
            title,
            description,
            albumImages: []
          },
          ...store.portfolioItems
        ],
        photographerProfile: {
          ...store.photographerProfile,
          portfolio: [imageData.imageUrl, ...store.photographerProfile.portfolio]
        }
      }));
      revalidatePath("/dashboard/photographer");
      revalidatePath("/photographers");
      return { success: true };
    }

    await prisma.photographerPortfolioItem.create({
      data: {
        photographerId: profile.id,
        ...imageData,
        title,
        description
      }
    });

    revalidatePath("/dashboard/photographer");
    revalidatePath("/photographers");
    revalidatePath(`/photographers/${profile.id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updatePortfolioItemAction(formData: FormData): Promise<ActionResult> {
  let newImagePublicId: string | undefined;
  let newImageData: ReturnType<typeof getPortfolioCoverMediaData> | undefined;
  let imageSaved = false;

  try {
    const { profile } = await requirePhotographerProfile();
    const id = String(formData.get("id") ?? "");
    const imageFile = formData.get("image") as File | null;
    const hasNewImage = Boolean(imageFile?.size);
    let imageUrl = String(formData.get("imageUrl") ?? "").trim() || placeholderImage;
    const title = String(formData.get("title") ?? "").trim();
    const description = "";

    if (hasNewImage && imageFile) {
      const validation = validateImageFile(imageFile, albumCoverMaxBytes);

      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const uploaded = await uploadImageToCloudinary(
        imageFile,
        "photographers/portfolio",
        albumCoverMaxBytes
      );
      newImageData = getPortfolioCoverMediaData(uploaded);
      imageUrl = newImageData.imageUrl;
      newImagePublicId = newImageData.imagePublicId;
    }

    if (!canUseDatabase()) {
      const store = await getDevStore();
      const oldPublicId = store.portfolioItems.find((item) => item.id === id)?.imagePublicId;
      await updateDevStore((store) => ({
        ...store,
        portfolioItems: store.portfolioItems.map((item) =>
          item.id === id
            ? {
                ...item,
                ...(newImageData ?? {
                  imageUrl,
                  imagePublicId: newImagePublicId ?? item.imagePublicId
                }),
                title,
                description
              }
            : item
        ),
        photographerProfile: {
          ...store.photographerProfile,
          portfolio: store.portfolioItems.map((item) =>
            item.id === id ? imageUrl : item.imageUrl
          )
        }
      }));
      imageSaved = true;
      if (newImagePublicId) {
        await deleteImageQuietly(oldPublicId);
      }
      revalidatePath("/dashboard/photographer");
      revalidatePath("/photographers");
      return { success: true };
    }

    const item = await prisma.photographerPortfolioItem.findUnique({ where: { id } });

    if (!item || item.photographerId !== profile.id) {
      return { success: false, error: "Portfolio item not found." };
    }

    await prisma.photographerPortfolioItem.update({
      where: { id },
      data: {
        ...(newImageData ?? {
          imageUrl,
          imagePublicId: newImagePublicId ?? item.imagePublicId
        }),
        title,
        description
      }
    });
    imageSaved = true;

    if (newImagePublicId) {
      await deleteImageQuietly(item.imagePublicId);
    }

    revalidatePath("/dashboard/photographer");
    revalidatePath(`/photographers/${profile.id}`);
    revalidatePath(`/photographers/${profile.id}/portfolio/${id}`);
    return { success: true };
  } catch (error) {
    if (newImagePublicId && !imageSaved) {
      await deleteImageQuietly(newImagePublicId);
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function savePhotographerPortfolioAction(
  formData: FormData
): Promise<ActionResult> {
  const uploadedPublicIds: string[] = [];
  let changesSaved = false;

  try {
    const { profile, session } = await requirePhotographerProfile();
    const itemIds = Array.from(
      new Set(formData.getAll("portfolioItemIds").map(String).filter(Boolean))
    );
    const newFile = formData.get("newPortfolioImage") as File | null;
    const newTitle = String(formData.get("newPortfolioTitle") ?? "").trim();
    const newDescription = "";
    const hasNewFile = Boolean(newFile?.size);
    const newAlbumFiles = getFiles(formData, "newAlbumImages");
    const newUploadedMedia = getUploadedAlbumMedia(
      formData,
      "uploadedMedia:newAlbumImages",
      session.user.id
    );
    const newAlbumOrder = getMediaOrder(formData, "mediaOrder:newAlbumImages");
    const newAlbumCoverKey = getCoverMediaKey(
      formData,
      "coverMedia:newAlbumImages"
    );
    const newAlbumCoverCrop = getCoverCrop(
      formData,
      "coverCrop:newAlbumImages"
    );
    const removedAlbumImageIds = Array.from(
      new Set(formData.getAll("removeAlbumImageIds").map(String).filter(Boolean))
    );

    if (
      !hasNewFile &&
      (newTitle || newAlbumFiles.length || newUploadedMedia.length) &&
      !newAlbumCoverKey
    ) {
      return {
        success: false,
        error: "Выберите фото для обложки нового альбома."
      };
    }

    const existingInputs = itemIds.map((id) => ({
      id,
      title: String(formData.get(`portfolioTitle:${id}`) ?? "").trim(),
      description: "",
      file: formData.get(`portfolioImage:${id}`) as File | null,
      albumFiles: getFiles(formData, `albumImages:${id}`),
      uploadedMedia: getUploadedAlbumMedia(
        formData,
        `uploadedMedia:albumImages:${id}`,
        session.user.id
      ),
      mediaOrder: getMediaOrder(formData, `mediaOrder:albumImages:${id}`),
      coverKey: getCoverMediaKey(formData, `coverMedia:albumImages:${id}`),
      coverCrop: getCoverCrop(formData, `coverCrop:albumImages:${id}`)
    }));
    const allNewAlbumFiles = [
      ...newAlbumFiles,
      ...existingInputs.flatMap((input) => input.albumFiles)
    ];

    if (
      allNewAlbumFiles.reduce((total, file) => total + file.size, 0) >
      albumUploadMaxBytes
    ) {
      return {
        success: false,
        error: `За одно сохранение можно загрузить не более ${formatMegabytes(albumUploadMaxBytes)} МБ содержимого альбомов.`
      };
    }
    if (newAlbumFiles.length + newUploadedMedia.length > 20) {
      return {
        success: false,
        error: "В одном альбоме может быть не более 20 изображений."
      };
    }

    for (const input of existingInputs) {
      if (input.file?.size) {
        const validation = validateImageFile(input.file, albumCoverMaxBytes);
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }
      }
      for (const albumFile of input.albumFiles) {
        const validation = validateImageFile(albumFile, albumImageMaxBytes);
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }
      }
    }

    if (hasNewFile && newFile) {
      const validation = validateImageFile(newFile, albumCoverMaxBytes);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
    }
    for (const albumFile of newAlbumFiles) {
      const validation = validateImageFile(albumFile, albumImageMaxBytes);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
    }

    if (!canUseDatabase()) {
      const store = await getDevStore();
      const ownedItems = store.portfolioItems.filter((item) => itemIds.includes(item.id));

      if (ownedItems.length !== itemIds.length) {
        return { success: false, error: "Некоторые работы портфолио не найдены." };
      }
      const ownedAlbumImageIds = new Set(
        ownedItems.flatMap((item) => item.albumImages.map((image) => image.id))
      );
      if (removedAlbumImageIds.some((id) => !ownedAlbumImageIds.has(id))) {
        return { success: false, error: "Некоторые кадры альбома не найдены." };
      }
      for (const input of existingInputs) {
        const item = ownedItems.find((candidate) => candidate.id === input.id);
        const remainingImages =
          item?.albumImages.filter(
            (image) => !removedAlbumImageIds.includes(image.id)
          ) ?? [];
        const existingKeys = getRemainingAlbumMediaKeys(
          item?.albumImages ?? [],
          removedAlbumImageIds
        );
        const incomingUploadedCount = getNewAlbumUploads(
          input.uploadedMedia,
          existingKeys
        ).length;
        if (
          remainingImages.length + input.albumFiles.length + incomingUploadedCount >
          20
        ) {
          return {
            success: false,
            error: "В одном альбоме может быть не более 20 изображений."
          };
        }
      }

      const replacements = new Map<
        string,
        CloudinaryUploadResult
      >();
      const albumUploads = new Map<
        string,
        UploadedAlbumMedia[]
      >();

      for (const input of existingInputs) {
        if (!input.file?.size) continue;
        const uploaded = await uploadImageToCloudinary(
          input.file,
          "photographers/portfolio",
          albumCoverMaxBytes
        );
        replacements.set(input.id, uploaded);
        uploadedPublicIds.push(uploaded.publicId);
      }
      for (const input of existingInputs) {
        const item = ownedItems.find((candidate) => candidate.id === input.id);
        const existingKeys = getRemainingAlbumMediaKeys(
          item?.albumImages ?? [],
          removedAlbumImageIds
        );
        const uploads = getNewAlbumUploads(input.uploadedMedia, existingKeys);
        for (const albumFile of input.albumFiles) {
          const uploaded = await uploadImageToCloudinary(
            albumFile,
            "photographers/albums",
            albumImageMaxBytes
          );
          uploads.push(cloudinaryResultToUploadedAlbumMedia(uploaded));
          uploadedPublicIds.push(uploaded.publicId);
        }
        albumUploads.set(input.id, uniqueUploadedAlbumMedia(uploads));
      }

      const uploadedNew =
        hasNewFile && newFile
          ? await uploadImageToCloudinary(
              newFile,
              "photographers/portfolio",
              albumCoverMaxBytes
            )
          : null;
      if (uploadedNew) {
        uploadedPublicIds.push(uploadedNew.publicId);
      }
      const uploadedNewAlbum = uniqueUploadedAlbumMedia(newUploadedMedia);
      for (const albumFile of newAlbumFiles) {
        const uploaded = await uploadImageToCloudinary(
          albumFile,
          "photographers/albums",
          albumImageMaxBytes
        );
        uploadedNewAlbum.push(cloudinaryResultToUploadedAlbumMedia(uploaded));
        uploadedPublicIds.push(uploaded.publicId);
      }
      const selectedNewCoverData = getSelectedAlbumCoverMediaData(
        newAlbumCoverKey,
        uploadedNewAlbum,
        newAlbumCoverCrop
      );
      const shouldCreateNewAlbum =
        Boolean(uploadedNew) ||
        Boolean(selectedNewCoverData) ||
        Boolean(newTitle || uploadedNewAlbum.length);

      if (shouldCreateNewAlbum && !uploadedNew && !selectedNewCoverData) {
        return {
          success: false,
          error: "Выберите фото для обложки нового альбома."
        };
      }

      const oldPublicIds: Array<string | undefined> = [];
      await updateDevStore((current) => {
        const nextItems = current.portfolioItems.map((item) => {
          const input = existingInputs.find((candidate) => candidate.id === item.id);
          if (!input) return item;
          const replacement = replacements.get(item.id);
          if (replacement) {
            oldPublicIds.push(item.imagePublicId);
          }
          const removedImages = item.albumImages.filter((image) =>
            removedAlbumImageIds.includes(image.id)
          );
          oldPublicIds.push(...removedImages.map((image) => image.imagePublicId));
          const remainingAlbumImages = item.albumImages.filter(
            (image) => !removedAlbumImageIds.includes(image.id)
          );
          const uploadedAlbumImages = (albumUploads.get(item.id) ?? []).map(
            (image, index) => ({
              id: `dev-album-${Date.now()}-${item.id}-${index}`,
              ...getAlbumImageData(image, remainingAlbumImages.length + index)
            })
          );
          const albumImages = [...remainingAlbumImages, ...uploadedAlbumImages];
          const orderedAlbumImages = orderAlbumMedia(
            albumImages,
            input.mediaOrder
          ).map((image, index) => ({ ...image, sortOrder: index }));
          const selectedCoverData = getSelectedAlbumCoverMediaData(
            input.coverKey,
            albumImages,
            input.coverCrop
          );
          const replacementData = replacement
            ? getPortfolioCoverMediaData(replacement)
            : null;
          return {
            ...item,
            ...(selectedCoverData ?? replacementData ?? {}),
            title: input.title,
            description: input.description,
            albumImages: orderedAlbumImages
          };
        });

        if (shouldCreateNewAlbum) {
          const newCoverData = uploadedNew
            ? getPortfolioCoverMediaData(uploadedNew)
            : selectedNewCoverData;

          if (!newCoverData) return current;

          nextItems.unshift({
            id: `dev-portfolio-${Date.now()}`,
            ...newCoverData,
            title: newTitle,
            description: newDescription,
            albumImages: orderAlbumMedia(uploadedNewAlbum, newAlbumOrder).map(
              (image, index) => ({
                id: `dev-album-${Date.now()}-new-${index}`,
                ...getAlbumImageData(image, index)
              })
            )
          });
        }

        return {
          ...current,
          portfolioItems: nextItems,
          photographerProfile: {
            ...current.photographerProfile,
            portfolio: nextItems.map((item) => item.imageUrl)
          }
        };
      });
      changesSaved = true;
      await Promise.all(oldPublicIds.map((publicId) => deleteImageQuietly(publicId)));
    } else {
      const existingItems = await prisma.photographerPortfolioItem.findMany({
        where: {
          id: { in: itemIds },
          photographerId: profile.id
        },
        include: { albumImages: true }
      });

      if (existingItems.length !== itemIds.length) {
        return { success: false, error: "Некоторые работы портфолио не найдены." };
      }
      const ownedAlbumImages = existingItems.flatMap((item) => item.albumImages);
      const ownedAlbumImageIds = new Set(ownedAlbumImages.map((image) => image.id));
      if (removedAlbumImageIds.some((id) => !ownedAlbumImageIds.has(id))) {
        return { success: false, error: "Некоторые кадры альбома не найдены." };
      }
      for (const input of existingInputs) {
        const item = existingItems.find((candidate) => candidate.id === input.id);
        const remainingImages =
          item?.albumImages.filter(
            (image) => !removedAlbumImageIds.includes(image.id)
          ) ?? [];
        const existingKeys = getRemainingAlbumMediaKeys(
          item?.albumImages ?? [],
          removedAlbumImageIds
        );
        const incomingUploadedCount = getNewAlbumUploads(
          input.uploadedMedia,
          existingKeys
        ).length;
        if (
          remainingImages.length + input.albumFiles.length + incomingUploadedCount >
          20
        ) {
          return {
            success: false,
            error: "В одном альбоме может быть не более 20 изображений."
          };
        }
      }
      const replacements = new Map<
        string,
        CloudinaryUploadResult
      >();
      const albumUploads = new Map<
        string,
        UploadedAlbumMedia[]
      >();

      for (const input of existingInputs) {
        if (!input.file?.size) continue;
        const uploaded = await uploadImageToCloudinary(
          input.file,
          "photographers/portfolio",
          albumCoverMaxBytes
        );
        replacements.set(input.id, uploaded);
        uploadedPublicIds.push(uploaded.publicId);
      }
      for (const input of existingInputs) {
        const item = existingItems.find((candidate) => candidate.id === input.id);
        const existingKeys = getRemainingAlbumMediaKeys(
          item?.albumImages ?? [],
          removedAlbumImageIds
        );
        const uploads = getNewAlbumUploads(input.uploadedMedia, existingKeys);
        for (const albumFile of input.albumFiles) {
          const uploaded = await uploadImageToCloudinary(
            albumFile,
            "photographers/albums",
            albumImageMaxBytes
          );
          uploads.push(cloudinaryResultToUploadedAlbumMedia(uploaded));
          uploadedPublicIds.push(uploaded.publicId);
        }
        albumUploads.set(input.id, uniqueUploadedAlbumMedia(uploads));
      }

      const uploadedNew =
        hasNewFile && newFile
          ? await uploadImageToCloudinary(
              newFile,
              "photographers/portfolio",
              albumCoverMaxBytes
            )
          : null;
      if (uploadedNew) {
        uploadedPublicIds.push(uploadedNew.publicId);
      }
      const uploadedNewAlbum = uniqueUploadedAlbumMedia(newUploadedMedia);
      for (const albumFile of newAlbumFiles) {
        const uploaded = await uploadImageToCloudinary(
          albumFile,
          "photographers/albums",
          albumImageMaxBytes
        );
        uploadedNewAlbum.push(cloudinaryResultToUploadedAlbumMedia(uploaded));
        uploadedPublicIds.push(uploaded.publicId);
      }
      const selectedNewCoverData = getSelectedAlbumCoverMediaData(
        newAlbumCoverKey,
        uploadedNewAlbum,
        newAlbumCoverCrop
      );
      const shouldCreateNewAlbum =
        Boolean(uploadedNew) ||
        Boolean(selectedNewCoverData) ||
        Boolean(newTitle || uploadedNewAlbum.length);

      if (shouldCreateNewAlbum && !uploadedNew && !selectedNewCoverData) {
        return {
          success: false,
          error: "Выберите фото для обложки нового альбома."
        };
      }

      await prisma.$transaction(async (transaction) => {
        if (removedAlbumImageIds.length) {
          await transaction.photographerPortfolioImage.deleteMany({
            where: { id: { in: removedAlbumImageIds } }
          });
        }
        for (const input of existingInputs) {
          const replacement = replacements.get(input.id);
          const item = existingItems.find((candidate) => candidate.id === input.id);
          const remainingAlbumImages =
            item?.albumImages.filter(
              (image) => !removedAlbumImageIds.includes(image.id)
            ) ?? [];
          const uploadedAlbumMedia = albumUploads.get(input.id) ?? [];
          const allAlbumMedia = [
            ...remainingAlbumImages,
            ...uploadedAlbumMedia
          ];
          const orderedAlbumMedia = orderAlbumMedia(allAlbumMedia, input.mediaOrder);
          const sortOrderByKey = new Map(
            orderedAlbumMedia.map((image, index) => [
              getAlbumMediaKey(image),
              index
            ])
          );
          const selectedCoverData = getSelectedAlbumCoverMediaData(
            input.coverKey,
            allAlbumMedia,
            input.coverCrop
          );

          await transaction.photographerPortfolioItem.update({
            where: { id: input.id },
            data: {
              title: input.title,
              description: input.description,
              ...(selectedCoverData ??
                (replacement ? getPortfolioCoverMediaData(replacement) : {})),
              albumImages: {
                create: uploadedAlbumMedia.map((image, index) =>
                  getAlbumImageData(
                    image,
                    sortOrderByKey.get(getAlbumMediaKey(image)) ??
                      remainingAlbumImages.length + index
                  )
                )
              }
            }
          });
          await Promise.all(
            remainingAlbumImages.map((image) =>
              transaction.photographerPortfolioImage.update({
                where: { id: image.id },
                data: {
                  sortOrder:
                    sortOrderByKey.get(getAlbumMediaKey(image)) ??
                    image.sortOrder
                }
              })
            )
          );
        }

        if (shouldCreateNewAlbum) {
          const newCoverData = uploadedNew
            ? getPortfolioCoverMediaData(uploadedNew)
            : selectedNewCoverData;

          if (!newCoverData) return;

          await transaction.photographerPortfolioItem.create({
            data: {
              photographerId: profile.id,
              ...newCoverData,
              title: newTitle,
              description: newDescription,
              albumImages: {
                create: orderAlbumMedia(uploadedNewAlbum, newAlbumOrder).map(
                  (image, index) => getAlbumImageData(image, index)
                )
              }
            }
          });
        }
      });
      changesSaved = true;

      const replacedOldPublicIds = existingItems
        .filter((item) => replacements.has(item.id))
        .map((item) => item.imagePublicId);
      const removedAlbumPublicIds = ownedAlbumImages
        .filter((image) => removedAlbumImageIds.includes(image.id))
        .map((image) => image.imagePublicId);
      await Promise.all(
        [...replacedOldPublicIds, ...removedAlbumPublicIds].map((publicId) =>
          deleteImageQuietly(publicId)
        )
      );
    }

    revalidatePath("/dashboard/photographer");
    revalidatePath("/photographers");
    revalidatePath(`/photographers/${profile.id}`);
    existingInputs.forEach((input) => {
      revalidatePath(`/photographers/${profile.id}/portfolio/${input.id}`);
    });
    revalidatePhotographerPublicData(
      profile.id,
      existingInputs.map((input) => input.id)
    );
    return { success: true };
  } catch (error) {
    if (!changesSaved) {
      await Promise.all(
        uploadedPublicIds.map((publicId) => deleteImageQuietly(publicId))
      );
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

function getFiles(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .filter((value): value is File => value instanceof File && value.size > 0);
}

function getMediaOrder(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "");

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return Array.from(
      new Set(
        parsed.filter((item): item is string => typeof item === "string" && Boolean(item))
      )
    );
  } catch {
    return [];
  }
}

function getCoverMediaKey(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function getCoverCrop(formData: FormData, name: string): AlbumCoverCrop | null {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<AlbumCoverCrop>;
    const key = cleanOptionalString(parsed.key);
    if (!key) return null;

    return {
      key,
      x: cleanCoverCropNumber(parsed.x, 50, 0, 100),
      y: cleanCoverCropNumber(parsed.y, 50, 0, 100),
      width: cleanCoverCropNumber(parsed.width, 80, 10, 100),
      height: cleanCoverCropNumber(parsed.height, 45, 10, 100),
      zoom: cleanCoverCropNumber(parsed.zoom, 100, 100, 220)
    };
  } catch {
    return null;
  }
}

function cleanCoverCropNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number
) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;

  return clampNumber(numeric, min, max);
}

function getUploadedAlbumMedia(
  formData: FormData,
  name: string,
  ownerId: string
): UploadedAlbumMedia[] {
  const uploaded = formData.getAll(name).flatMap((value) => {
    try {
      const parsed = JSON.parse(String(value)) as UploadedAlbumMedia;
      const isSupportedMedia = ["IMAGE", "VIDEO"].includes(parsed.mediaType);
      const isSupabaseAlbumMedia = parsed.imagePublicId.startsWith(
        `supabase:photographers/albums/${ownerId}/`
      );
      const isCloudinaryAlbumVideo =
        parsed.mediaType === "VIDEO" &&
        parsed.imagePublicId.startsWith(
          `cloudinary:video:photographers/albums/${ownerId}/`
        );
      const isCloudinaryAlbumImage =
        parsed.mediaType === "IMAGE" &&
        parsed.imagePublicId.startsWith(
          `cloudinary:image:photographers/albums/${ownerId}/`
        );
      if (
        !parsed.imageUrl ||
        !isSupportedMedia ||
        (!isSupabaseAlbumMedia && !isCloudinaryAlbumVideo && !isCloudinaryAlbumImage)
      ) {
        return [];
      }
      return [
        {
          imageUrl: String(parsed.imageUrl),
          imagePublicId: String(parsed.imagePublicId),
          mediaType: parsed.mediaType,
          provider: parsed.provider ?? inferMediaProvider(parsed.imagePublicId),
          bytes: cleanOptionalInt(parsed.bytes),
          originalBytes: cleanOptionalInt(parsed.originalBytes),
          width: cleanOptionalInt(parsed.width),
          height: cleanOptionalInt(parsed.height),
          format: cleanOptionalString(parsed.format)
        }
      ];
    } catch {
      return [];
    }
  });

  return uniqueUploadedAlbumMedia(uploaded);
}

export async function deletePortfolioItemAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile } = await requirePhotographerProfile();
    const id = String(formData.get("id") ?? "");
    if (!canUseDatabase()) {
      const store = await getDevStore();
      const deletedItem = store.portfolioItems.find((item) => item.id === id);
      await updateDevStore((store) => ({
        ...store,
        portfolioItems: store.portfolioItems.filter((item) => item.id !== id),
        photographerProfile: {
          ...store.photographerProfile,
          portfolio: store.portfolioItems
            .filter((item) => item.id !== id)
            .map((item) => item.imageUrl)
        }
      }));
      await deleteImageFromCloudinary(deletedItem?.imagePublicId);
      await Promise.all(
        (deletedItem?.albumImages ?? []).map((image) =>
          deleteImageFromCloudinary(image.imagePublicId)
        )
      );
      revalidatePath("/dashboard/photographer");
      revalidatePath("/photographers");
      return { success: true };
    }

    const item = await prisma.photographerPortfolioItem.findUnique({
      where: { id },
      include: { albumImages: true }
    });

    if (!item || item.photographerId !== profile.id) {
      return { success: false, error: "Portfolio item not found." };
    }

    await prisma.photographerPortfolioItem.delete({ where: { id } });
    await deleteImageFromCloudinary(item.imagePublicId);
    await Promise.all(
      item.albumImages.map((image) => deleteImageFromCloudinary(image.imagePublicId))
    );

    revalidatePath("/dashboard/photographer");
    revalidatePath(`/photographers/${profile.id}`);
    revalidatePath(`/photographers/${profile.id}/portfolio/${id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function createPhotographerAvailabilitySlotAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { profile } = await requirePhotographerProfile();
    const values = parseSlot(formData);

    if (!canUseDatabase()) {
      const values = parseSlot(formData);
      await updateDevStore((store) => ({
        ...store,
        photographerSlots: [
          {
            id: `dev-slot-${Date.now()}`,
            date: values.date.toISOString().slice(0, 10),
            startTime: values.startTime,
            endTime: values.endTime,
            isAvailable: values.isAvailable
          },
          ...store.photographerSlots
        ]
      }));
      revalidatePath("/dashboard/photographer");
      return { success: true };
    }

    await prisma.availabilitySlot.create({
      data: {
        photographerId: profile.id,
        ...values
      }
    });

    revalidatePath("/dashboard/photographer");
    revalidatePath("/booking");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateAvailabilitySlotAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile } = await requirePhotographerProfile();
    const id = String(formData.get("id") ?? "");

    if (!canUseDatabase()) {
      const values = parseSlot(formData);
      await updateDevStore((store) => ({
        ...store,
        photographerSlots: store.photographerSlots.map((slot) =>
          slot.id === id
            ? {
                ...slot,
                date: values.date.toISOString().slice(0, 10),
                startTime: values.startTime,
                endTime: values.endTime,
                isAvailable: values.isAvailable
              }
            : slot
        )
      }));
      revalidatePath("/dashboard/photographer");
      return { success: true };
    }

    const slot = await prisma.availabilitySlot.findUnique({ where: { id } });

    if (!slot || slot.photographerId !== profile.id) {
      return { success: false, error: "Slot not found." };
    }

    await prisma.availabilitySlot.update({
      where: { id },
      data: parseSlot(formData)
    });

    revalidatePath("/dashboard/photographer");
    revalidatePath("/booking");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteAvailabilitySlotAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile } = await requirePhotographerProfile();
    const id = String(formData.get("id") ?? "");

    if (!canUseDatabase()) {
      await updateDevStore((store) => ({
        ...store,
        photographerSlots: store.photographerSlots.filter((slot) => slot.id !== id)
      }));
      revalidatePath("/dashboard/photographer");
      return { success: true };
    }

    const slot = await prisma.availabilitySlot.findUnique({ where: { id } });

    if (!slot || slot.photographerId !== profile.id) {
      return { success: false, error: "Slot not found." };
    }

    await prisma.availabilitySlot.delete({ where: { id } });

    revalidatePath("/dashboard/photographer");
    revalidatePath("/booking");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updatePhotographerBookingStatusAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { profile } = await requirePhotographerProfile();
    const bookingId = String(formData.get("bookingId") ?? "");
    const nextStatus = String(formData.get("status") ?? "") as BookingStatus;

    if (!canUseDatabase()) {
      revalidatePath("/dashboard/photographer");
      return { success: true };
    }

    await autoCompletePastBookings();

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    if (!booking || booking.photographerId !== profile.id) {
      return { success: false, error: "Booking not found." };
    }

    if (
      nextStatus === BookingStatus.CONFIRMED &&
      booking.platformFeeStatus !== "PAID" &&
      !["DEPOSIT_PAID", "FINAL_PAYMENT_PENDING", "FULLY_PAID"].includes(booking.paymentStatus)
    ) {
      return { success: false, error: "Нельзя подтвердить бронь до оплаты сервисного сбора." };
    }

    if (!isValidStatusTransition(booking.status, nextStatus)) {
      return { success: false, error: "Невалидный переход статуса." };
    }

    if (nextStatus === BookingStatus.IN_PROGRESS) {
      assertCanMoveBookingToInProgress(booking);
    }

    // TODO: Позже разделить подтверждение на photographerConfirmationStatus и studioConfirmationStatus.
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: nextStatus }
    });
    if (
      nextStatus === BookingStatus.CANCELLED ||
      nextStatus === BookingStatus.DECLINED
    ) {
      await Promise.all([
        cancelPlatformBookingEvent(booking.id),
        cancelBookingHolds(booking.id)
      ]);
    }
    await notifyBookingStatusChanged(booking.id, nextStatus);

    revalidatePath("/dashboard/photographer");
    revalidatePath("/dashboard/studio");
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function resolvePhotographerRescheduleAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { profile } = await requirePhotographerProfile();
    const bookingId = String(formData.get("bookingId") ?? "");
    const decision = String(formData.get("decision") ?? "");

    if (!canUseDatabase()) {
      return { success: false, error: "Решение по переносу требует подключения к базе." };
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    if (!booking || booking.photographerId !== profile.id) {
      return { success: false, error: "Booking not found." };
    }

    if (!booking.rescheduleRequestedAt) {
      return { success: false, error: "По этой брони нет активного запроса на перенос." };
    }

    if (decision === "accept") {
      if (
        booking.platformFeeStatus !== "PAID" &&
        !["DEPOSIT_PAID", "FINAL_PAYMENT_PENDING", "FULLY_PAID"].includes(booking.paymentStatus)
      ) {
        return { success: false, error: "Нельзя подтвердить перенос до оплаты сервисного сбора." };
      }

      await prisma.$transaction(async (transaction) => {
        await transaction.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.CONFIRMED,
            rescheduleRequestedAt: null,
            rescheduleComment: null,
            rescheduleCount: { increment: 1 }
          }
        });
        await createPlatformBookingEvent(booking.id, transaction);
      });

      await notifyBookingStatusChanged(booking.id, BookingStatus.CONFIRMED);
    } else if (decision === "decline") {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.DECLINED,
          rescheduleRequestedAt: null,
          rescheduleComment: null
        }
      });
      await Promise.all([
        cancelPlatformBookingEvent(booking.id),
        cancelBookingHolds(booking.id)
      ]);
      await notifyBookingStatusChanged(booking.id, BookingStatus.DECLINED);
    } else {
      return { success: false, error: "Неизвестное решение по переносу." };
    }

    revalidatePath("/dashboard/photographer");
    revalidatePath("/dashboard/photographer/calendar");
    revalidatePath("/dashboard/client");
    revalidatePath("/dashboard/client/bookings");
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function requestPhotographerFinalPaymentAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { profile } = await requirePhotographerProfile();
    const bookingId = String(formData.get("bookingId") ?? "");

    if (!canUseDatabase()) {
      return { success: false, error: "Завершение работы требует подключения к базе." };
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.photographerId !== profile.id) {
      return { success: false, error: "Booking not found." };
    }

    if (booking.status !== BookingStatus.IN_PROGRESS) {
      return { success: false, error: "Сначала переведите бронь в работу." };
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.COMPLETED,
        completedAt: new Date()
      }
    });
    await cancelPlatformBookingEvent(booking.id);
    await notifyBookingStatusChanged(booking.id, BookingStatus.COMPLETED);
    revalidatePath("/dashboard/photographer");
    revalidatePath("/dashboard/photographer/calendar");
    revalidatePath("/dashboard/client");
    revalidatePath("/dashboard/client/bookings");
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

function parseSlot(formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const isAvailable = formData.get("isAvailable") === "on";

  if (!date || !startTime || !endTime) {
    throw new Error("Заполните дату, начало и конец слота.");
  }

  return {
    date: new Date(`${date}T00:00:00.000Z`),
    startTime,
    endTime,
    isAvailable
  };
}

function isValidStatusTransition(current: BookingStatus, next: BookingStatus) {
  const allowed: Partial<Record<BookingStatus, BookingStatus[]>> = {
    PENDING: [BookingStatus.CONFIRMED, BookingStatus.DECLINED],
    PENDING_PLATFORM_FEE: [BookingStatus.CONFIRMED, BookingStatus.DECLINED],
    CONFIRMED: [BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED],
    IN_PROGRESS: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
    COMPLETED: [],
    CANCELLED: [],
    DECLINED: []
  };

  return allowed[current]?.includes(next) ?? false;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

async function deleteImageQuietly(publicId?: string | null) {
  try {
    await deleteImageFromCloudinary(publicId);
  } catch {
    // The database already points to the new image, so cleanup must not fail the save.
  }
}

function slugifyStyleName(value: string) {
  const transliteration: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "c",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya"
  };
  const transliterated = value
    .toLocaleLowerCase("ru")
    .split("")
    .map((character) => transliteration[character] ?? character)
    .join("");
  const slug = transliterated
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `custom-style-${Date.now()}`;
}
