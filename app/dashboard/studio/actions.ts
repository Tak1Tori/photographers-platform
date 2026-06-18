"use server";

import { BookingStatus, HallStatus, UserRole } from "@prisma/client";
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
  "https://images.unsplash.com/photo-1604014237800-1c9102c219da?auto=format&fit=crop&w=900&q=80";

type ActionResult = { success: boolean; error?: string };

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
    const { profile } = await requireStudioProfile();
    const name = String(formData.get("name") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const rules = String(formData.get("rules") ?? "").trim();

    if (!name || !city || !address || !description) {
      return { success: false, error: "Заполните название, город, адрес и описание." };
    }

    if (!canUseDatabase()) {
      await updateDevStore((store) => ({
        ...store,
        studioProfile: {
          ...store.studioProfile,
          name,
          city,
          address,
          description,
          rules: rules.split("\n").filter(Boolean)
        }
      }));
      revalidatePath("/dashboard/studio");
      revalidatePath("/studios");
      return { success: true };
    }

    await prisma.studioProfile.update({
      where: { id: profile.id },
      data: { name, city, address, description, rules }
    });

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
    const { profile } = await requireStudioProfile();
    const file = formData.get("image") as File | null;
    const validation = validateImageFile(file);

    if (!validation.valid || !file) {
      return { success: false, error: validation.error };
    }

    const uploaded = await uploadImageToCloudinary(file, "studios/covers");

    if (!canUseDatabase()) {
      const oldPublicId = "imagePublicId" in profile ? profile.imagePublicId : undefined;
      await updateDevStore((store) => ({
        ...store,
        studioProfile: {
          ...store.studioProfile,
          imageUrl: uploaded.secureUrl,
          imagePublicId: uploaded.publicId
        }
      }));
      await deleteImageFromCloudinary(oldPublicId);
      revalidatePath("/dashboard/studio");
      revalidatePath("/studios");
      return { success: true };
    }

    const oldPublicId = "imagePublicId" in profile ? profile.imagePublicId : undefined;
    await prisma.studioProfile.update({
      where: { id: profile.id },
      data: {
        imageUrl: uploaded.secureUrl,
        imagePublicId: uploaded.publicId
      }
    });
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
    const validation = validateImageFile(file);

    if (!validation.valid || !file) {
      return { success: false, error: validation.error };
    }

    const data = parseHall(formData);
    const uploaded = await uploadImageToCloudinary(file, "studios/halls");

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
              imageUrl: uploaded.secureUrl,
              imagePublicId: uploaded.publicId,
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
        imageUrl: uploaded.secureUrl,
        imagePublicId: uploaded.publicId
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
    const validation = validateImageFile(file);

    if (!validation.valid || !file) {
      return { success: false, error: validation.error };
    }

    const uploaded = await uploadImageToCloudinary(file, "studios/halls");

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
                  imageUrl: uploaded.secureUrl,
                  imagePublicId: uploaded.publicId
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
      data: {
        imageUrl: uploaded.secureUrl,
        imagePublicId: uploaded.publicId
      }
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

    const hall = await prisma.studioHall.findUnique({ where: { id } });

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
      await deleteImageFromCloudinary(deletedHall?.imagePublicId);
      revalidatePath("/dashboard/studio");
      revalidatePath("/studios");
      return { success: true };
    }

    const hall = await prisma.studioHall.findUnique({ where: { id } });

    if (!hall || hall.studioId !== profile.id) {
      return { success: false, error: "Hall not found." };
    }

    await prisma.studioHall.delete({ where: { id } });
    await deleteImageFromCloudinary(hall.imagePublicId);

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

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    if (!booking || booking.studioId !== profile.id) {
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

    revalidatePath("/dashboard/studio");
    revalidatePath("/dashboard/photographer");
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
