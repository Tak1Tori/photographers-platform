"use server";

import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { createPhotographerOnlyBooking, createStudioOnlyBooking } from "@/lib/data/bookings";
import { canUseDatabase } from "@/lib/data/db";
import { getSession } from "@/lib/auth";
import { notifyBookingCreated } from "@/lib/notifications/notification-service";
import {
  EQUIPMENT_OPTIONS,
  LOCATION_TYPES,
  RENTAL_PURPOSES,
  SHOOT_TYPES,
  STUDIO_EQUIPMENT_OPTIONS
} from "@/lib/booking-options";
import {
  sanitizeUserText,
  validateNoContactInfo
} from "@/lib/validation/contact-sanitizer";
import type {
  CreateBookingResult,
  CreatePhotographerOnlyBookingInput,
  CreateStudioOnlyBookingInput
} from "@/lib/types";

type FieldErrors = Record<string, string>;

export async function createPhotographerOnlyBookingAction(
  formData: FormData
): Promise<CreateBookingResult & { fieldErrors?: FieldErrors }> {
  const session = await getSession();
  if (!session?.user) {
    return { success: false, error: "Войдите как клиент, чтобы создать бронь." };
  }

  const allowedRoles: UserRole[] = [UserRole.CLIENT, UserRole.ADMIN];
  if (!allowedRoles.includes(session.user.role)) {
    return { success: false, error: "Создать клиентскую заявку может только клиент." };
  }

  if (!canUseDatabase()) {
    return {
      success: false,
      error: "DATABASE_URL не настроен. Создание реальной брони требует PostgreSQL."
    };
  }

  const parsed = parsePhotographerOnlyForm(formData);

  if (Object.keys(parsed.fieldErrors).length > 0 || !parsed.input) {
    return {
      success: false,
      error: "Проверьте поля формы.",
      fieldErrors: parsed.fieldErrors
    };
  }

  const input: CreatePhotographerOnlyBookingInput = {
    ...parsed.input,
    clientId: session.user.id
  };

  try {
    const { booking, paymentSession } = await createPhotographerOnlyBooking(input);
    await notifyBookingCreated(booking.id);

    revalidatePath("/dashboard/client");
    revalidatePath("/dashboard/client/bookings");
    revalidatePath("/dashboard/photographer");
    revalidatePath("/admin");

    return {
      success: true,
      bookingNumber: booking.bookingNumber,
      paymentId: paymentSession.paymentId,
      checkoutUrl: paymentSession.checkoutUrl
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Не удалось создать бронь."
    };
  }
}

export async function createStudioOnlyBookingAction(
  formData: FormData
): Promise<CreateBookingResult & { fieldErrors?: FieldErrors }> {
  const session = await getSession();
  if (!session?.user) {
    return { success: false, error: "Войдите как клиент, чтобы создать бронь." };
  }
  const allowedRoles: UserRole[] = [UserRole.CLIENT, UserRole.ADMIN];

  if (!allowedRoles.includes(session.user.role)) {
    return { success: false, error: "Создать клиентскую заявку может только клиент." };
  }

  if (!canUseDatabase()) {
    return {
      success: false,
      error: "DATABASE_URL не настроен. Создание реальной брони требует PostgreSQL."
    };
  }

  const parsed = parseStudioOnlyForm(formData);

  if (Object.keys(parsed.fieldErrors).length > 0 || !parsed.input) {
    return {
      success: false,
      error: "Проверьте поля формы.",
      fieldErrors: parsed.fieldErrors
    };
  }

  const input: CreateStudioOnlyBookingInput = {
    ...parsed.input,
    clientId: session.user.id
  };

  try {
    const { booking, paymentSession } = await createStudioOnlyBooking(input);
    await notifyBookingCreated(booking.id);

    revalidatePath("/dashboard/client");
    revalidatePath("/dashboard/client/bookings");
    revalidatePath("/dashboard/studio");
    revalidatePath("/admin");

    return {
      success: true,
      bookingNumber: booking.bookingNumber,
      paymentId: paymentSession.paymentId,
      checkoutUrl: paymentSession.checkoutUrl
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Не удалось создать бронь."
    };
  }
}

function parsePhotographerOnlyForm(formData: FormData) {
  const fieldErrors: FieldErrors = {};
  const get = (key: string) => String(formData.get(key) ?? "").trim();
  const photographerId = get("photographerId");
  const shootType = get("shootType");
  const shootDescription = sanitizeUserText(get("shootDescription"));
  const locationType = get("locationType");
  const city = sanitizeUserText(get("city")) || "Алматы";
  const district = sanitizeUserText(get("district"));
  const addressDetails = sanitizeUserText(get("addressDetails"));
  const date = get("date");
  const startTime = get("startTime");
  const durationHours = Number(get("durationHours"));
  const peopleCountRaw = get("peopleCount");
  const peopleCount = peopleCountRaw ? Number(peopleCountRaw) : undefined;
  const equipmentNeeded = formData
    .getAll("equipmentNeeded")
    .map(String)
    .filter((value) => EQUIPMENT_OPTIONS.some((option) => option.value === value));
  const specialRequirements = sanitizeUserText(get("specialRequirements"));
  const clientName = sanitizeUserText(get("clientName"));
  const clientPhone = get("clientPhone");
  const clientEmail = get("clientEmail").toLowerCase();

  if (!photographerId) fieldErrors.photographerId = "Сначала выберите фотографа.";
  if (!SHOOT_TYPES.some((option) => option.value === shootType)) {
    fieldErrors.shootType = "Выберите тип съемки.";
  }
  if (!shootDescription) fieldErrors.shootDescription = "Опишите задачу для фотографа.";
  if (!LOCATION_TYPES.some((option) => option.value === locationType)) {
    fieldErrors.locationType = "Выберите тип локации.";
  }
  if (!city) fieldErrors.city = "Укажите город.";
  if (!date) fieldErrors.date = "Выберите дату.";
  if (!startTime) fieldErrors.startTime = "Выберите время.";
  if (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > 8) {
    fieldErrors.durationHours = "Выберите длительность.";
  }
  if (peopleCount !== undefined && (!Number.isInteger(peopleCount) || peopleCount < 1 || peopleCount > 100)) {
    fieldErrors.peopleCount = "Количество людей должно быть от 1 до 100.";
  }
  if (!clientName) fieldErrors.clientName = "Укажите имя.";
  if (!clientPhone) fieldErrors.clientPhone = "Укажите телефон.";
  if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    fieldErrors.clientEmail = "Укажите корректный email.";
  }

  for (const [field, value] of [
    ["shootDescription", shootDescription],
    ["addressDetails", addressDetails],
    ["specialRequirements", specialRequirements]
  ] as const) {
    const result = validateNoContactInfo(value);
    if (!result.valid) fieldErrors[field] = result.error!;
  }

  return {
    fieldErrors,
    input:
      Object.keys(fieldErrors).length === 0
        ? {
            photographerId,
            shootType,
            shootDescription,
            locationType,
            city,
            district,
            addressDetails,
            date,
            startTime,
            durationHours,
            peopleCount,
            equipmentNeeded:
              equipmentNeeded.length > 0 ? equipmentNeeded : ["NO_SPECIAL_EQUIPMENT"],
            specialRequirements,
            clientName,
            clientPhone,
            clientEmail
          }
        : undefined
  };
}

function parseStudioOnlyForm(formData: FormData) {
  const fieldErrors: FieldErrors = {};
  const get = (key: string) => String(formData.get(key) ?? "").trim();
  const studioId = get("studioId");
  const studioHallId = get("studioHallId");
  const rentalPurpose = get("rentalPurpose");
  const shootDescription = sanitizeUserText(get("shootDescription"));
  const date = get("date");
  const startTime = get("startTime");
  const durationHours = Number(get("durationHours"));
  const peopleCountRaw = get("peopleCount");
  const peopleCount = peopleCountRaw ? Number(peopleCountRaw) : undefined;
  const needsEquipment = formData.get("needsEquipment") === "on";
  const selectedAmenities = formData
    .getAll("selectedAmenities")
    .map(String)
    .filter(Boolean)
    .slice(0, 30);
  const specialRequirements = sanitizeUserText(get("specialRequirements"));
  const clientName = sanitizeUserText(get("clientName"));
  const clientPhone = get("clientPhone");
  const clientEmail = get("clientEmail").toLowerCase();
  const capacity = Number(get("selectedHallCapacity"));
  const allowedEquipment = new Set<string>(STUDIO_EQUIPMENT_OPTIONS.map((option) => option.value));
  const normalizedAmenities = selectedAmenities.filter((value) =>
    allowedEquipment.has(value) || value.length <= 80
  );

  if (!studioId && !studioHallId) fieldErrors.studioHallId = "Сначала выберите студию или зал.";
  if (!studioHallId) fieldErrors.studioHallId = "Выберите зал.";
  if (!RENTAL_PURPOSES.some((option) => option.value === rentalPurpose)) {
    fieldErrors.rentalPurpose = "Выберите цель аренды.";
  }
  if (!shootDescription) fieldErrors.shootDescription = "Опишите задачу для студии.";
  if (!date) fieldErrors.date = "Выберите дату.";
  if (!startTime) fieldErrors.startTime = "Выберите время.";
  if (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > 8) {
    fieldErrors.durationHours = "Выберите длительность.";
  }
  if (peopleCount !== undefined && (!Number.isInteger(peopleCount) || peopleCount < 1)) {
    fieldErrors.peopleCount = "Количество людей должно быть больше 0.";
  }
  if (
    peopleCount !== undefined &&
    Number.isFinite(capacity) &&
    capacity > 0 &&
    peopleCount > capacity
  ) {
    fieldErrors.peopleCount = `Вместимость выбранного зала: ${capacity} человек.`;
  }
  if (!clientName) fieldErrors.clientName = "Укажите имя.";
  if (!clientPhone) fieldErrors.clientPhone = "Укажите телефон.";
  if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    fieldErrors.clientEmail = "Укажите корректный email.";
  }

  for (const [field, value] of [
    ["shootDescription", shootDescription],
    ["specialRequirements", specialRequirements]
  ] as const) {
    const result = validateNoContactInfo(value);
    if (!result.valid) fieldErrors[field] = result.error!;
  }

  return {
    fieldErrors,
    input:
      Object.keys(fieldErrors).length === 0
        ? {
            studioId,
            studioHallId,
            rentalPurpose,
            shootDescription,
            date,
            startTime,
            durationHours,
            peopleCount,
            needsEquipment,
            selectedAmenities: normalizedAmenities,
            specialRequirements,
            clientName,
            clientPhone,
            clientEmail
          }
        : undefined
  };
}
