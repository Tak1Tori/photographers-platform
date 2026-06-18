"use server";

import { BookingStatus, ProfileStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { canUseDatabase } from "@/lib/data/db";
import { getDevStore, updateDevStore } from "@/lib/data/dev-store";
import { notifyBookingStatusChanged } from "@/lib/notifications/notification-service";
import { prisma } from "@/lib/prisma";
import {
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
  validateImageFile
} from "@/lib/uploads";

const placeholderImage =
  "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80";

type ActionResult = { success: boolean; error?: string };

const customStyleImage =
  "https://images.unsplash.com/photo-1452780212940-6f5c0d14d848?auto=format&fit=crop&w=1200&q=80";

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
    revalidatePath("/styles");
    revalidatePath("/photographers");
    revalidatePath(`/photographers/${profile.id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updatePhotographerProfileAction(formData: FormData): Promise<ActionResult> {
  let newAvatarPublicId: string | undefined;
  let avatarSaved = false;

  try {
    const { profile } = await requirePhotographerProfile();
    const name = String(formData.get("name") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const bio = String(formData.get("bio") ?? "").trim();
    const avatarFile = formData.get("avatar") as File | null;
    const hasNewAvatar = Boolean(avatarFile?.size);
    let avatarUrl = String(formData.get("avatarUrl") ?? "").trim() || placeholderImage;
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
      const validation = validateImageFile(avatarFile);

      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const uploaded = await uploadImageToCloudinary(avatarFile, "photographers/avatars");
      avatarUrl = uploaded.secureUrl;
      newAvatarPublicId = uploaded.publicId;
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

    await prisma.photographerProfile.update({
      where: { id: profile.id },
      data: {
        name,
        city,
        bio,
        avatarUrl,
        avatarPublicId:
          newAvatarPublicId ??
          ("avatarPublicId" in profile ? profile.avatarPublicId : undefined),
        hourlyRate,
        styles: {
          set: existingStyles.map(({ slug }) => ({ slug }))
        }
      }
    });
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

export async function createPortfolioItemAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile } = await requirePhotographerProfile();
    const imageUrl = String(formData.get("imageUrl") ?? "").trim() || placeholderImage;
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    if (!canUseDatabase()) {
      await updateDevStore((store) => ({
        ...store,
        portfolioItems: [
          {
            id: `dev-portfolio-${Date.now()}`,
            imageUrl,
            title,
            description
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
    const description = String(formData.get("description") ?? "").trim();
    const validation = validateImageFile(file);

    if (!validation.valid || !file) {
      return { success: false, error: validation.error };
    }

    const uploaded = await uploadImageToCloudinary(file, "photographers/portfolio");

    if (!canUseDatabase()) {
      await updateDevStore((store) => ({
        ...store,
        portfolioItems: [
          {
            id: `dev-portfolio-${Date.now()}`,
            imageUrl: uploaded.secureUrl,
            imagePublicId: uploaded.publicId,
            title,
            description
          },
          ...store.portfolioItems
        ],
        photographerProfile: {
          ...store.photographerProfile,
          portfolio: [uploaded.secureUrl, ...store.photographerProfile.portfolio]
        }
      }));
      revalidatePath("/dashboard/photographer");
      revalidatePath("/photographers");
      return { success: true };
    }

    await prisma.photographerPortfolioItem.create({
      data: {
        photographerId: profile.id,
        imageUrl: uploaded.secureUrl,
        imagePublicId: uploaded.publicId,
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
  let imageSaved = false;

  try {
    const { profile } = await requirePhotographerProfile();
    const id = String(formData.get("id") ?? "");
    const imageFile = formData.get("image") as File | null;
    const hasNewImage = Boolean(imageFile?.size);
    let imageUrl = String(formData.get("imageUrl") ?? "").trim() || placeholderImage;
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    if (hasNewImage && imageFile) {
      const validation = validateImageFile(imageFile);

      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const uploaded = await uploadImageToCloudinary(imageFile, "photographers/portfolio");
      imageUrl = uploaded.secureUrl;
      newImagePublicId = uploaded.publicId;
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
                imageUrl,
                imagePublicId: newImagePublicId ?? item.imagePublicId,
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
        imageUrl,
        imagePublicId: newImagePublicId ?? item.imagePublicId,
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
    return { success: true };
  } catch (error) {
    if (newImagePublicId && !imageSaved) {
      await deleteImageQuietly(newImagePublicId);
    }
    return { success: false, error: getErrorMessage(error) };
  }
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
      revalidatePath("/dashboard/photographer");
      revalidatePath("/photographers");
      return { success: true };
    }

    const item = await prisma.photographerPortfolioItem.findUnique({ where: { id } });

    if (!item || item.photographerId !== profile.id) {
      return { success: false, error: "Portfolio item not found." };
    }

    await prisma.photographerPortfolioItem.delete({ where: { id } });
    await deleteImageFromCloudinary(item.imagePublicId);

    revalidatePath("/dashboard/photographer");
    revalidatePath(`/photographers/${profile.id}`);
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

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    if (!booking || booking.photographerId !== profile.id) {
      return { success: false, error: "Booking not found." };
    }

    if (nextStatus === BookingStatus.CONFIRMED && !["DEPOSIT_PAID", "PAID"].includes(booking.paymentStatus)) {
      return { success: false, error: "Нельзя подтвердить бронь до оплаты депозита." };
    }

    if (!isValidStatusTransition(booking.status, nextStatus)) {
      return { success: false, error: "Невалидный переход статуса." };
    }

    // TODO: Позже разделить подтверждение на photographerConfirmationStatus и studioConfirmationStatus.
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: nextStatus }
    });
    await notifyBookingStatusChanged(booking.id, nextStatus);

    revalidatePath("/dashboard/photographer");
    revalidatePath("/dashboard/studio");
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
  const allowed: Record<BookingStatus, BookingStatus[]> = {
    PENDING: [BookingStatus.CONFIRMED, BookingStatus.DECLINED],
    CONFIRMED: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
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
