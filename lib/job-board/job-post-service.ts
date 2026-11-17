import { JobPostStatus, JobResponseStatus, ProfileStatus } from "@prisma/client";
import { canUseDatabase } from "@/lib/data/db";
import { prisma } from "@/lib/prisma";
import type { JobPostCard, JobPostDetails, JobResponseItem } from "@/lib/job-board/types";

type JobPostWithRelations = {
  id: string;
  title: string;
  description: string;
  city: string;
  date: Date;
  startTime: string;
  durationHours: number;
  budget: number;
  status: JobPostStatus;
  expiresAt: Date;
  createdAt: Date;
  style: { id: string; name: string } | null;
  responses: Array<{ photographer: { userId: string } }>;
  _count: { responses: number };
};

const responseInclude = {
  photographer: {
    select: {
      id: true,
      userId: true,
      name: true,
      city: true,
      rating: true,
      avatarUrl: true
    }
  }
} as const;

export async function expireOpenJobPosts() {
  if (!canUseDatabase()) return;

  await prisma.jobPost.updateMany({
    where: { status: JobPostStatus.PUBLISHED, expiresAt: { lt: new Date() } },
    data: { status: JobPostStatus.EXPIRED, closedAt: new Date() }
  });
}

export async function getJobPosts(filters: {
  city?: string;
  date?: string;
  styleId?: string;
  maxBudget?: number;
  photographerUserId?: string;
} = {}): Promise<JobPostCard[]> {
  if (!canUseDatabase()) return [];
  await expireOpenJobPosts();

  const date = isDateFilter(filters.date) ? new Date(`${filters.date}T00:00:00`) : undefined;
  const nextDate = date ? new Date(date.getTime() + 86_400_000) : undefined;
  const posts = await prisma.jobPost.findMany({
    where: {
      status: JobPostStatus.PUBLISHED,
      expiresAt: { gte: new Date() },
      city: filters.city ? { equals: filters.city, mode: "insensitive" } : undefined,
      date: date && nextDate ? { gte: date, lt: nextDate } : undefined,
      styleId: filters.styleId || undefined,
      budget: filters.maxBudget ? { lte: filters.maxBudget } : undefined
    },
    include: {
      style: { select: { id: true, name: true } },
      responses: { where: { photographer: { userId: filters.photographerUserId } }, select: { photographer: { select: { userId: true } } } },
      _count: { select: { responses: true } }
    },
    orderBy: [{ date: "asc" }, { publishedAt: "desc" }],
    take: 60
  });

  return posts.map((post) => mapJobPostCard(post, filters.photographerUserId));
}

export async function getClientJobPosts(clientId: string): Promise<JobPostCard[]> {
  if (!canUseDatabase()) return [];
  await expireOpenJobPosts();
  const posts = await prisma.jobPost.findMany({
    where: { clientId },
    include: {
      style: { select: { id: true, name: true } },
      responses: { select: { photographer: { select: { userId: true } } } },
      _count: { select: { responses: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  return posts.map((post) => mapJobPostCard(post));
}

export async function getJobPostDetails(id: string, viewer?: { userId: string; role: string }): Promise<JobPostDetails | undefined> {
  if (!canUseDatabase()) return undefined;
  await expireOpenJobPosts();
  const post = await prisma.jobPost.findUnique({
    where: { id },
    include: {
      style: { select: { id: true, name: true } },
      client: { select: { name: true } },
      responses: {
        include: responseInclude,
        orderBy: { createdAt: "asc" }
      },
      _count: { select: { responses: true } }
    }
  });
  if (!post) return undefined;

  const isOwner = viewer?.userId === post.clientId;
  const isPhotographer = viewer?.role === "PHOTOGRAPHER";
  const ownResponse = post.responses.find((response) => response.photographer.userId === viewer?.userId);
  const visibleResponses = isOwner || ownResponse ? post.responses : [];
  const selectedResponse = post.responses.find((response) => response.status === JobResponseStatus.ACCEPTED);

  return {
    ...mapJobPostCard(post, viewer?.userId),
    clientName: isOwner ? post.client.name : undefined,
    isOwner,
    canRespond: Boolean(isPhotographer && post.status === JobPostStatus.PUBLISHED && !ownResponse),
    responses: visibleResponses.map(mapResponse),
    selectedResponse: selectedResponse ? mapResponse(selectedResponse) : undefined
  };
}

export async function createJobPost(clientId: string, input: {
  title: string;
  description: string;
  city: string;
  date: string;
  startTime: string;
  durationHours: number;
  budget: number;
  styleId?: string;
}) {
  const date = new Date(`${input.date}T12:00:00`);
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  return prisma.jobPost.create({
    data: { ...input, date, clientId, expiresAt }
  });
}

export async function createJobResponse(input: {
  jobPostId: string;
  photographerUserId: string;
  message: string;
  quotedPrice: number;
}) {
  const photographer = await prisma.photographerProfile.findFirst({
    where: { userId: input.photographerUserId, status: ProfileStatus.PUBLISHED },
    select: { id: true }
  });
  if (!photographer) throw new Error("Сначала опубликуйте профиль фотографа.");

  const post = await prisma.jobPost.findFirst({
    where: { id: input.jobPostId, status: JobPostStatus.PUBLISHED, expiresAt: { gte: new Date() } },
    select: { clientId: true, title: true }
  });
  if (!post) throw new Error("Это объявление уже закрыто или недоступно.");

  await prisma.jobResponse.create({
    data: {
      jobPostId: input.jobPostId,
      photographerId: photographer.id,
      message: input.message,
      quotedPrice: input.quotedPrice
    }
  });
  return post;
}

export async function acceptJobResponse(input: { responseId: string; clientId: string }) {
  return prisma.$transaction(async (tx) => {
    const response = await tx.jobResponse.findFirst({
      where: { id: input.responseId, jobPost: { clientId: input.clientId, status: JobPostStatus.PUBLISHED } },
      include: { photographer: { select: { id: true, userId: true } }, jobPost: { select: { id: true, title: true } } }
    });
    if (!response) throw new Error("Отклик недоступен для выбора.");

    const selected = await tx.jobPost.updateMany({
      where: { id: response.jobPostId, clientId: input.clientId, status: JobPostStatus.PUBLISHED },
      data: { status: JobPostStatus.SELECTED, selectedAt: new Date() }
    });
    if (!selected.count) throw new Error("Фотограф уже выбран для этого объявления.");

    await tx.jobResponse.updateMany({
      where: { jobPostId: response.jobPostId, id: { not: response.id }, status: JobResponseStatus.PENDING },
      data: { status: JobResponseStatus.DECLINED }
    });
    await tx.jobResponse.update({ where: { id: response.id }, data: { status: JobResponseStatus.ACCEPTED } });
    return response;
  });
}

export async function getJobBoardBookingContext(input: { jobPostId?: string; clientId?: string; photographerId?: string }) {
  if (!input.jobPostId || !input.clientId || !input.photographerId || !canUseDatabase()) return undefined;
  const post = await prisma.jobPost.findFirst({
    where: {
      id: input.jobPostId,
      clientId: input.clientId,
      status: JobPostStatus.SELECTED,
      responses: { some: { photographerId: input.photographerId, status: JobResponseStatus.ACCEPTED } }
    },
    select: { title: true, city: true, date: true, startTime: true, durationHours: true, budget: true }
  });
  return post ? { ...post, date: post.date.toISOString() } : undefined;
}

function mapJobPostCard(post: JobPostWithRelations, viewerUserId?: string): JobPostCard {
  return {
    id: post.id,
    title: post.title,
    description: post.description,
    city: post.city,
    date: post.date.toISOString(),
    startTime: post.startTime,
    durationHours: post.durationHours,
    budget: post.budget,
    status: post.status,
    expiresAt: post.expiresAt.toISOString(),
    createdAt: post.createdAt.toISOString(),
    style: post.style ? { id: post.style.id, title: post.style.name } : undefined,
    responsesCount: post._count.responses,
    hasResponded: Boolean(viewerUserId && post.responses.some((response) => response.photographer.userId === viewerUserId))
  };
}

function mapResponse(response: {
  id: string;
  message: string;
  quotedPrice: number;
  status: JobResponseStatus;
  createdAt: Date;
  photographer: { id: string; name: string; city: string; rating: number; avatarUrl: string };
}): JobResponseItem {
  return {
    id: response.id,
    message: response.message,
    quotedPrice: response.quotedPrice,
    status: response.status,
    createdAt: response.createdAt.toISOString(),
    photographer: {
      id: response.photographer.id,
      name: response.photographer.name,
      city: response.photographer.city,
      rating: response.photographer.rating,
      imageUrl: response.photographer.avatarUrl
    }
  };
}

function isDateFilter(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return Number.isFinite(new Date(`${value}T00:00:00`).getTime());
}
