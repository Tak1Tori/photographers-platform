"use server";

import { BookingStatus, HallStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { canUseDatabase } from "@/lib/data/db";
import { getDevStore, updateDevStore } from "@/lib/data/dev-store";
import {
  notifyBookingStatusChanged,
  notifyFinalPaymentRequested
} from "@/lib/notifications/notification-service";
import { createFinalPaymentForBooking } from "@/lib/payments/payment-service";
import { cancelPlatformBookingEvent } from "@/lib/calendar/calendar-service";
import { cancelBookingHolds } from "@/lib/calendar/hold-service";
import {
  assertCanMoveBookingToInProgress,
  autoCompletePastBookings
} from "@/lib/bookings/status-service";
import { prisma } from "@/lib/prisma";
import {
  avatarImageMaxBytes,
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
  validateImageFile
} from "@/lib/uploads";
import type { CloudinaryUploadResult } from "@/lib/cloudinary";

const placeholderImage =
  "https://images.unsplash.com/photo-1604014237800-1c9102c219da?auto=format&fit=crop&w=900&q=80";

type ActionResult = { success: boolean; error?: string };

function getStudioImageData(uploaded: CloudinaryUploadResult) {
  return {
    imageUrl: uploaded.secureUrl,
    imagePublicId: uploaded.publicId,
    imageProvider: uploaded.provider,
    imageBytes: uploaded.bytes,
    imageOriginalBytes: uploaded.originalBytes,
    imageWidth: uploaded.width,
    imageHeight: uploaded.height,
    imageFormat: uploaded.format,
    imageMediaType: uploaded.mediaType
  };
}

function getStudioHallGalleryImageData(uploaded: CloudinaryUploadResult, sortOrder: number) {
  return {
    imageUrl: uploaded.secureUrl,
    imagePublicId: uploaded.publicId,
    sortOrder,
    provider: uploaded.provider,
    bytes: uploaded.bytes,
    originalBytes: uploaded.originalBytes,
    width: uploaded.width,
    height: uploaded.height,
    format: uploaded.format
  };
}

async function requireStudioProfile() {
  const session = await getSession();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const allowedRoles: UserRole[] = [UserRole.STUDIO_OWNER, UserRole.ADMIN];
  if (!allowedRoles.includes(session.user.role)) {
    throw new Error("Forbidden");
  }

  const profile = canUseDatabase()
    ? await prisma.studioProfile.findFirst({
        where: { ownerId: session.user.id }
      })
    : (await getDevStore()).studioProfile;

  if (!profile) {
    throw new Error("Studio profile not found");
  }

  return { session, profile };
}

export async function updateStudioProfileAction(formData: FormData): Promise<ActionResult> {
  try {
    const { session, profile } = await requireStudioProfile();
    const name = String(formData.get("name") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim();
    const twoGisUrl = normalizeTwoGisUrl(String(formData.get("twoGisUrl") ?? "").trim());
    const description = String(formData.get("description") ?? "").trim();
    const rules = String(formData.get("rules") ?? "").trim();
    const file = formData.get("image") as File | null;
    const hasNewImage = Boolean(file && file.size > 0);
    const validation = hasNewImage ? validateImageFile(file, avatarImageMaxBytes) : { valid: true };

    if (!name || !city || !address || !description) {
      return { success: false, error: "Заполните название, город, адрес и описание." };
    }

    if (twoGisUrl && !isAllowedTwoGisUrl(twoGisUrl)) {
      return { success: false, error: "Вставьте корректную ссылку 2GIS." };
    }

    if (!validation.valid || (hasNewImage && !file)) {
      return { success: false, error: validation.error };
    }

    const uploaded = hasNewImage && file
      ? await uploadImageToCloudinary(file, "studios/covers", avatarImageMaxBytes)
      : null;
    const imageData = uploaded ? getStudioImageData(uploaded) : null;

    if (!canUseDatabase()) {
      const oldPublicId = uploaded && "imagePublicId" in profile ? profile.imagePublicId : undefined;
      await updateDevStore((store) => ({
        ...store,
        studioProfile: {
          ...store.studioProfile,
          name,
          city,
          address,
          twoGisUrl: twoGisUrl ?? undefined,
          description,
          rules: rules.split("\n").filter(Boolean),
          ...(imageData ?? {})
        }
      }));
      await deleteImageFromCloudinary(oldPublicId);
      revalidatePath("/dashboard/studio");
      revalidatePath("/studios");
      return { success: true };
    }

    const oldPublicId = uploaded && "imagePublicId" in profile ? profile.imagePublicId : undefined;
    await prisma.$transaction([
      prisma.studioProfile.update({
        where: { id: profile.id },
        data: {
          name,
          city,
          address,
          twoGisUrl,
          description,
          rules,
          ...(imageData ?? {})
        }
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: {
          name,
          ...(imageData ? { image: imageData.imageUrl } : {})
        }
      })
    ]);
    await deleteImageFromCloudinary(oldPublicId);

    revalidatePath("/dashboard/studio");
    revalidatePath("/studios");
    revalidatePath(`/studios/${profile.id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function uploadStudioImageAction(formData: FormData): Promise<ActionResult> {
  try {
    const { session, profile } = await requireStudioProfile();
    const file = formData.get("image") as File | null;
    const validation = validateImageFile(file, avatarImageMaxBytes);

    if (!validation.valid || !file) {
      return { success: false, error: validation.error };
    }

    const uploaded = await uploadImageToCloudinary(file, "studios/covers", avatarImageMaxBytes);
    const imageData = getStudioImageData(uploaded);

    if (!canUseDatabase()) {
      const oldPublicId = "imagePublicId" in profile ? profile.imagePublicId : undefined;
      await updateDevStore((store) => ({
        ...store,
        studioProfile: {
          ...store.studioProfile,
          ...imageData
        }
      }));
      await deleteImageFromCloudinary(oldPublicId);
      revalidatePath("/dashboard/studio");
      revalidatePath("/studios");
      return { success: true };
    }

    const oldPublicId = "imagePublicId" in profile ? profile.imagePublicId : undefined;
    await prisma.$transaction([
      prisma.studioProfile.update({
        where: { id: profile.id },
        data: imageData
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: { image: imageData.imageUrl }
      })
    ]);
    await deleteImageFromCloudinary(oldPublicId);

    revalidatePath("/dashboard/studio");
    revalidatePath("/studios");
    revalidatePath(`/studios/${profile.id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function createStudioHallAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile } = await requireStudioProfile();
    const data = parseHall(formData);

    if (!canUseDatabase()) {
      await updateDevStore((store) => ({
        ...store,
        studioProfile: {
          ...store.studioProfile,
          halls: [
            {
              id: `dev-hall-${Date.now()}`,
              name: data.name,
              description: data.description,
              capacity: data.capacity,
              pricePerHour: data.hourlyRate,
              imageUrl: data.imageUrl,
              amenities: data.amenities as string[],
              status: data.status === HallStatus.ACTIVE ? "Active" : "Inactive"
            },
            ...store.studioProfile.halls
          ]
        }
      }));
      revalidatePath("/dashboard/studio");
      revalidatePath("/studios");
      return { success: true };
    }

    await prisma.studioHall.create({
      data: {
        studioId: profile.id,
        ...data
      }
    });

    revalidatePath("/dashboard/studio");
    revalidatePath("/studios");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function createStudioHallWithImageAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile } = await requireStudioProfile();
    const file = formData.get("image") as File | null;
    const validation = validateImageFile(file, avatarImageMaxBytes);

    if (!validation.valid || !file) {
      return { success: false, error: validation.error };
    }

    const data = parseHall(formData);
    const uploaded = await uploadImageToCloudinary(file, "studios/halls", avatarImageMaxBytes);
    const imageData = getStudioImageData(uploaded);

    if (!canUseDatabase()) {
      await updateDevStore((store) => ({
        ...store,
        studioProfile: {
          ...store.studioProfile,
          halls: [
            {
              id: `dev-hall-${Date.now()}`,
              name: data.name,
              description: data.description,
              capacity: data.capacity,
              pricePerHour: data.hourlyRate,
              ...imageData,
              amenities: data.amenities as string[],
              status: data.status === HallStatus.ACTIVE ? "Active" : "Inactive"
            },
            ...store.studioProfile.halls
          ]
        }
      }));
      revalidatePath("/dashboard/studio");
      revalidatePath("/studios");
      return { success: true };
    }

    await prisma.studioHall.create({
      data: {
        studioId: profile.id,
        ...data,
        ...imageData
      }
    });

    revalidatePath("/dashboard/studio");
    revalidatePath("/studios");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateStudioHallImageAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile } = await requireStudioProfile();
    const id = String(formData.get("id") ?? "");
    const file = formData.get("image") as File | null;
    const validation = validateImageFile(file, avatarImageMaxBytes);

    if (!validation.valid || !file) {
      return { success: false, error: validation.error };
    }

    const uploaded = await uploadImageToCloudinary(file, "studios/halls", avatarImageMaxBytes);
    const imageData = getStudioImageData(uploaded);

    if (!canUseDatabase()) {
      const store = await getDevStore();
      const hall = store.studioProfile.halls.find((item) => item.id === id);
      if (!hall) return { success: false, error: "Hall not found." };
      await updateDevStore((store) => ({
        ...store,
        studioProfile: {
          ...store.studioProfile,
          halls: store.studioProfile.halls.map((item) =>
            item.id === id
              ? {
                  ...item,
                  ...imageData
                }
              : item
          )
        }
      }));
      await deleteImageFromCloudinary(hall.imagePublicId);
      revalidatePath("/dashboard/studio");
      revalidatePath("/studios");
      return { success: true };
    }

    const hall = await prisma.studioHall.findUnique({ where: { id } });

    if (!hall || hall.studioId !== profile.id) {
      return { success: false, error: "Hall not found." };
    }

    await prisma.studioHall.update({
      where: { id },
      data: imageData
    });
    await deleteImageFromCloudinary(hall.imagePublicId);

    revalidatePath("/dashboard/studio");
    revalidatePath("/studios");
    revalidatePath(`/studios/${profile.id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function uploadStudioHallGalleryAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile } = await requireStudioProfile();
    const studioHallId = String(formData.get("id") ?? "");
    const files = formData
      .getAll("images")
      .filter((file): file is File => file instanceof File && file.size > 0);

    if (!studioHallId) {
      return { success: false, error: "Hall not found." };
    }

    if (files.length === 0) {
      return { success: false, error: "Выберите фото для галереи." };
    }

    if (files.length > 7) {
      return { success: false, error: "Можно загрузить максимум 7 фото в галерею." };
    }

    for (const file of files) {
      const validation = validateImageFile(file, avatarImageMaxBytes);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
    }

    if (!canUseDatabase()) {
      const store = await getDevStore();
      const hall = store.studioProfile.halls.find((item) => item.id === studioHallId);
      if (!hall) return { success: false, error: "Hall not found." };

      const existingImages = hall.galleryImages ?? [];
      if (existingImages.length + files.length > 7) {
        return { success: false, error: "В галерее зала может быть максимум 7 фото." };
      }

      const uploaded = await Promise.all(
        files.map((file) => uploadImageToCloudinary(file, "studios/halls/gallery", avatarImageMaxBytes))
      );

      await updateDevStore((store) => ({
        ...store,
        studioProfile: {
          ...store.studioProfile,
          halls: store.studioProfile.halls.map((item) =>
            item.id === studioHallId
              ? {
                  ...item,
                  galleryImages: [
                    ...(item.galleryImages ?? []),
                    ...uploaded.map((image, index) => ({
                      id: `dev-hall-gallery-${Date.now()}-${index}`,
                      ...getStudioHallGalleryImageData(
                        image,
                        (item.galleryImages ?? []).length + index
                      )
                    }))
                  ]
                }
              : item
          )
        }
      }));

      revalidatePath("/dashboard/studio");
      revalidatePath("/studios");
      return { success: true };
    }

    const hall = await prisma.studioHall.findUnique({
      where: { id: studioHallId },
      include: { galleryImages: true }
    });

    if (!hall || hall.studioId !== profile.id) {
      return { success: false, error: "Hall not found." };
    }

    if (hall.galleryImages.length + files.length > 7) {
      return { success: false, error: "В галерее зала может быть максимум 7 фото." };
    }

    const uploaded = await Promise.all(
      files.map((file) => uploadImageToCloudinary(file, "studios/halls/gallery", avatarImageMaxBytes))
    );
    const startOrder = hall.galleryImages.length;

    await prisma.studioHallImage.createMany({
      data: uploaded.map((image, index) => ({
        studioHallId,
        ...getStudioHallGalleryImageData(image, startOrder + index)
      }))
    });

    revalidatePath("/dashboard/studio");
    revalidatePath("/studios");
    revalidatePath(`/studios/${profile.id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteStudioHallGalleryImageAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile } = await requireStudioProfile();
    const imageId = String(formData.get("imageId") ?? "");

    if (!imageId) {
      return { success: false, error: "Image not found." };
    }

    if (!canUseDatabase()) {
      const store = await getDevStore();
      const deletedImage = store.studioProfile.halls
        .flatMap((hall) => hall.galleryImages ?? [])
        .find((image) => image.id === imageId);

      await updateDevStore((store) => ({
        ...store,
        studioProfile: {
          ...store.studioProfile,
          halls: store.studioProfile.halls.map((hall) => ({
            ...hall,
            galleryImages: (hall.galleryImages ?? []).filter((image) => image.id !== imageId)
          }))
        }
      }));
      await deleteImageFromCloudinary(deletedImage?.imagePublicId);
      revalidatePath("/dashboard/studio");
      revalidatePath("/studios");
      return { success: true };
    }

    const image = await prisma.studioHallImage.findUnique({
      where: { id: imageId },
      include: { studioHall: true }
    });

    if (!image || image.studioHall.studioId !== profile.id) {
      return { success: false, error: "Image not found." };
    }

    await prisma.studioHallImage.delete({ where: { id: image.id } });
    await deleteImageFromCloudinary(image.imagePublicId);

    revalidatePath("/dashboard/studio");
    revalidatePath("/studios");
    revalidatePath(`/studios/${profile.id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateStudioHallAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile } = await requireStudioProfile();
    const id = String(formData.get("id") ?? "");
    const data = parseHall(formData);

    if (!canUseDatabase()) {
      await updateDevStore((store) => ({
        ...store,
        studioProfile: {
          ...store.studioProfile,
          halls: store.studioProfile.halls.map((hall) =>
            hall.id === id
              ? {
                  ...hall,
                  name: data.name,
                  description: data.description,
                  capacity: data.capacity,
                  pricePerHour: data.hourlyRate,
                  imageUrl: data.imageUrl,
                  amenities: data.amenities as string[],
                  status: data.status === HallStatus.ACTIVE ? "Active" : "Inactive"
                }
              : hall
          )
        }
      }));
      revalidatePath("/dashboard/studio");
      revalidatePath("/studios");
      return { success: true };
    }

    const hall = await prisma.studioHall.findUnique({
      where: { id },
      include: { galleryImages: true }
    });

    if (!hall || hall.studioId !== profile.id) {
      return { success: false, error: "Hall not found." };
    }

    await prisma.studioHall.update({
      where: { id },
      data
    });

    revalidatePath("/dashboard/studio");
    revalidatePath("/studios");
    revalidatePath(`/studios/${profile.id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteStudioHallAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile } = await requireStudioProfile();
    const id = String(formData.get("id") ?? "");

    if (!canUseDatabase()) {
      const store = await getDevStore();
      const deletedHall = store.studioProfile.halls.find((hall) => hall.id === id);
      await updateDevStore((store) => ({
        ...store,
        studioProfile: {
          ...store.studioProfile,
          halls: store.studioProfile.halls.filter((hall) => hall.id !== id)
        },
        studioSlots: store.studioSlots.filter((slot) => slot.studioHallId !== id)
      }));
      await Promise.all([
        deleteImageFromCloudinary(deletedHall?.imagePublicId),
        ...(deletedHall?.galleryImages ?? []).map((image) =>
          deleteImageFromCloudinary(image.imagePublicId)
        )
      ]);
      revalidatePath("/dashboard/studio");
      revalidatePath("/studios");
      return { success: true };
    }

    const hall = await prisma.studioHall.findUnique({
      where: { id },
      include: { galleryImages: true }
    });

    if (!hall || hall.studioId !== profile.id) {
      return { success: false, error: "Hall not found." };
    }

    await prisma.studioHall.delete({ where: { id } });
    await Promise.all([
      deleteImageFromCloudinary(hall.imagePublicId),
      ...hall.galleryImages.map((image) => deleteImageFromCloudinary(image.imagePublicId))
    ]);

    revalidatePath("/dashboard/studio");
    revalidatePath("/studios");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function createStudioAvailabilitySlotAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { profile } = await requireStudioProfile();
    const studioHallId = String(formData.get("studioHallId") ?? "");

    if (!canUseDatabase()) {
      const values = parseSlot(formData);
      const store = await getDevStore();
      const hall = store.studioProfile.halls.find((item) => item.id === studioHallId);
      if (!hall) return { success: false, error: "Hall not found." };
      await updateDevStore((store) => ({
        ...store,
        studioSlots: [
          {
            id: `dev-studio-slot-${Date.now()}`,
            studioHallId,
            studioHallName: hall.name,
            date: values.date.toISOString().slice(0, 10),
            startTime: values.startTime,
            endTime: values.endTime,
            isAvailable: values.isAvailable
          },
          ...store.studioSlots
        ]
      }));
      revalidatePath("/dashboard/studio");
      return { success: true };
    }

    await assertHallOwner(studioHallId, profile.id);

    await prisma.availabilitySlot.create({
      data: {
        studioHallId,
        ...parseSlot(formData)
      }
    });

    revalidatePath("/dashboard/studio");
    revalidatePath("/booking");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateStudioAvailabilitySlotAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { profile } = await requireStudioProfile();
    const id = String(formData.get("id") ?? "");
    const studioHallId = String(formData.get("studioHallId") ?? "");
    const values = parseSlot(formData);

    if (!canUseDatabase()) {
      const store = await getDevStore();
      const hall = store.studioProfile.halls.find((item) => item.id === studioHallId);
      if (!hall) return { success: false, error: "Hall not found." };
      await updateDevStore((store) => ({
        ...store,
        studioSlots: store.studioSlots.map((slot) =>
          slot.id === id
            ? {
                ...slot,
                studioHallId,
                studioHallName: hall.name,
                date: values.date.toISOString().slice(0, 10),
                startTime: values.startTime,
                endTime: values.endTime,
                isAvailable: values.isAvailable
              }
            : slot
        )
      }));
      revalidatePath("/dashboard/studio");
      return { success: true };
    }

    const slot = await prisma.availabilitySlot.findUnique({ where: { id } });

    if (!slot) {
      return { success: false, error: "Slot not found." };
    }

    await assertHallOwner(studioHallId, profile.id);

    await prisma.availabilitySlot.update({
      where: { id },
      data: {
        studioHallId,
        ...values
      }
    });

    revalidatePath("/dashboard/studio");
    revalidatePath("/booking");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteStudioAvailabilitySlotAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { profile } = await requireStudioProfile();
    const id = String(formData.get("id") ?? "");

    if (!canUseDatabase()) {
      await updateDevStore((store) => ({
        ...store,
        studioSlots: store.studioSlots.filter((slot) => slot.id !== id)
      }));
      revalidatePath("/dashboard/studio");
      return { success: true };
    }

    const slot = await prisma.availabilitySlot.findUnique({
      where: { id },
      include: { studioHall: true }
    });

    if (!slot || slot.studioHall?.studioId !== profile.id) {
      return { success: false, error: "Slot not found." };
    }

    await prisma.availabilitySlot.delete({ where: { id } });

    revalidatePath("/dashboard/studio");
    revalidatePath("/booking");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateStudioBookingStatusAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile } = await requireStudioProfile();
    const bookingId = String(formData.get("bookingId") ?? "");
    const nextStatus = String(formData.get("status") ?? "") as BookingStatus;

    if (!canUseDatabase()) {
      revalidatePath("/dashboard/studio");
      return { success: true };
    }

    await autoCompletePastBookings();

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    if (!booking || booking.studioId !== profile.id) {
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

    revalidatePath("/dashboard/studio");
    revalidatePath("/dashboard/photographer");
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function requestStudioFinalPaymentAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { profile } = await requireStudioProfile();
    const bookingId = String(formData.get("bookingId") ?? "");

    if (!canUseDatabase()) {
      return { success: false, error: "Завершение работы требует подключения к базе." };
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.studioId !== profile.id) {
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
    revalidatePath("/dashboard/studio");
    revalidatePath("/dashboard/studio/calendar");
    revalidatePath("/dashboard/client");
    revalidatePath("/dashboard/client/bookings");
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

async function assertHallOwner(hallId: string, studioId: string) {
  const hall = await prisma.studioHall.findUnique({ where: { id: hallId } });

  if (!hall || hall.studioId !== studioId) {
    throw new Error("Hall not found.");
  }
}

function parseHall(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const capacity = Number(formData.get("capacity") ?? 0);
  const hourlyRate = Number(formData.get("hourlyRate") ?? 0);
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || placeholderImage;
  const amenities = String(formData.get("amenities") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const status = formData.get("status") === "ACTIVE" ? HallStatus.ACTIVE : HallStatus.INACTIVE;

  if (!name || !description) {
    throw new Error("Заполните название и описание зала.");
  }

  if (!Number.isFinite(capacity) || capacity <= 0) {
    throw new Error("Вместимость должна быть больше 0.");
  }

  if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
    throw new Error("Цена за час должна быть положительным числом.");
  }

  return {
    name,
    description,
    capacity,
    hourlyRate,
    imageUrl,
    amenities,
    status
  };
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

function normalizeTwoGisUrl(value: string) {
  if (!value) return null;
  const iframeSrc = extractIframeSrc(value);
  return (iframeSrc ?? value).trim() || null;
}

function extractIframeSrc(value: string) {
  return value.match(/\ssrc=["']([^"']+)["']/i)?.[1];
}

function isAllowedTwoGisUrl(value: string) {
  try {
    const url = new URL(value);
    return isTwoGisHost(url.hostname);
  } catch {
    return false;
  }
}

function isTwoGisHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "2gis.kz" ||
    normalized === "2gis.ru" ||
    normalized === "2gis.com" ||
    normalized.endsWith(".2gis.kz") ||
    normalized.endsWith(".2gis.ru") ||
    normalized.endsWith(".2gis.com") ||
    normalized === "dgis.kz" ||
    normalized.endsWith(".dgis.kz")
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}
