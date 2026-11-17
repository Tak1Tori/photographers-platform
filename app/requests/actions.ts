"use server";

import { JobPostStatus, NotificationType, Prisma, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import {
  acceptJobResponse,
  createJobPost,
  createJobResponse
} from "@/lib/job-board/job-post-service";
import { createNotification } from "@/lib/notifications/notification-service";
import { prisma } from "@/lib/prisma";
import { sanitizeUserText, validateNoContactInfo } from "@/lib/validation/contact-sanitizer";

type ActionResult = {
  success: boolean;
  error?: string;
  message?: string;
};

export async function createJobPostAction(formData: FormData): Promise<ActionResult & { id?: string }> {
  try {
    const session = await requireRole([UserRole.CLIENT]);
    const title = sanitizeUserText(text(formData, "title")).slice(0, 110);
    const description = sanitizeUserText(text(formData, "description")).slice(0, 1500);
    const city = sanitizeUserText(text(formData, "city")).slice(0, 80);
    const date = text(formData, "date");
    const startTime = text(formData, "startTime");
    const durationHours = Number(text(formData, "durationHours"));
    const budget = Number(text(formData, "budget"));
    const styleId = text(formData, "styleId");

    if (title.length < 6) return { success: false, error: "Название должно содержать не менее 6 символов." };
    if (description.length < 20) return { success: false, error: "Опишите задачу хотя бы в 20 символах." };
    if (!validateNoContactInfo(`${title} ${description}`).valid) {
      return { success: false, error: "Не указывайте контакты в объявлении — они откроются после выбора фотографа." };
    }
    if (city.length < 2) return { success: false, error: "Укажите город." };
    if (!isFutureOrToday(date)) return { success: false, error: "Дата съёмки не может быть в прошлом." };
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) return { success: false, error: "Укажите время начала." };
    if (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > 12) {
      return { success: false, error: "Длительность должна быть от 1 до 12 часов." };
    }
    if (!Number.isInteger(budget) || budget < 5_000 || budget > 2_000_000) {
      return { success: false, error: "Укажите бюджет от 5 000 до 2 000 000 ₸." };
    }
    if (styleId && !(await prisma.style.findUnique({ where: { id: styleId }, select: { id: true } }))) {
      return { success: false, error: "Выберите стиль из списка." };
    }

    const post = await createJobPost(session.user.id, {
      title,
      description,
      city,
      date,
      startTime,
      durationHours,
      budget,
      styleId: styleId || undefined
    });
    revalidateJobBoard(post.id);
    return { success: true, id: post.id };
  } catch (error) {
    return { success: false, error: message(error, "Не удалось опубликовать объявление.") };
  }
}

export async function createJobResponseAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireRole([UserRole.PHOTOGRAPHER]);
    const jobPostId = text(formData, "jobPostId");
    const response = sanitizeUserText(text(formData, "message")).slice(0, 1200);
    const quotedPrice = Number(text(formData, "quotedPrice"));

    if (!jobPostId) return { success: false, error: "Объявление не найдено." };
    if (response.length < 10) return { success: false, error: "Напишите предложение хотя бы в 10 символов." };
    if (!validateNoContactInfo(response).valid) {
      return { success: false, error: "Не указывайте контакты в отклике — они откроются после выбора." };
    }
    if (!Number.isInteger(quotedPrice) || quotedPrice < 5_000 || quotedPrice > 2_000_000) {
      return { success: false, error: "Укажите цену от 5 000 до 2 000 000 ₸." };
    }

    const created = await createJobResponse({
      jobPostId,
      photographerUserId: session.user.id,
      message: response,
      quotedPrice
    });
    await createNotification({
      userId: created.clientId,
      type: NotificationType.JOB_RESPONSE_CREATED,
      title: "Новый отклик на объявление",
      message: `На «${created.title}» пришёл новый отклик.`,
      linkUrl: `/requests/${jobPostId}`
    });
    revalidateJobBoard(jobPostId);
    return { success: true, message: "Отклик отправлен клиенту." };
  } catch (error) {
    if (isUniqueError(error)) return { success: false, error: "Вы уже откликнулись на это объявление." };
    return { success: false, error: message(error, "Не удалось отправить отклик.") };
  }
}

export async function acceptJobResponseAction(responseId: string): Promise<ActionResult & { bookingUrl?: string }> {
  try {
    const session = await requireRole([UserRole.CLIENT]);
    const accepted = await acceptJobResponse({ responseId, clientId: session.user.id });
    await createNotification({
      userId: accepted.photographer.userId,
      type: NotificationType.JOB_RESPONSE_ACCEPTED,
      title: "Ваш отклик выбран",
      message: `Клиент выбрал вас для «${accepted.jobPost.title}».`,
      linkUrl: `/requests/${accepted.jobPostId}`
    });
    revalidateJobBoard(accepted.jobPostId);
    return {
      success: true,
      bookingUrl: `/booking/new?type=PHOTOGRAPHER_ONLY&photographerId=${accepted.photographerId}&jobPostId=${accepted.jobPostId}`
    };
  } catch (error) {
    return { success: false, error: message(error, "Не удалось выбрать фотографа.") };
  }
}

export async function closeJobPostAction(jobPostId: string): Promise<ActionResult> {
  try {
    const session = await requireRole([UserRole.CLIENT]);
    const result = await prisma.jobPost.updateMany({
      where: { id: jobPostId, clientId: session.user.id, status: { in: [JobPostStatus.PUBLISHED, JobPostStatus.PAUSED] } },
      data: { status: JobPostStatus.CLOSED, closedAt: new Date() }
    });
    if (!result.count) return { success: false, error: "Это объявление уже закрыто." };
    revalidateJobBoard(jobPostId);
    return { success: true, message: "Объявление закрыто." };
  } catch (error) {
    return { success: false, error: message(error, "Не удалось закрыть объявление.") };
  }
}

async function requireRole(roles: UserRole[]) {
  const session = await getSession();
  if (!session?.user) throw new Error("Войдите в аккаунт, чтобы продолжить.");
  if (!roles.includes(session.user.role)) throw new Error("Недостаточно прав для этого действия.");
  return session;
}

function revalidateJobBoard(jobPostId?: string) {
  revalidatePath("/requests");
  revalidatePath("/requests/new");
  revalidatePath("/dashboard/client/requests");
  revalidatePath("/dashboard/photographer/requests");
  if (jobPostId) revalidatePath(`/requests/${jobPostId}`);
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function isFutureOrToday(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Number.isFinite(date.getTime()) && date >= today;
}

function isUniqueError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
