export type JobPostStatusLabel = "DRAFT" | "PUBLISHED" | "SELECTED" | "PAUSED" | "CLOSED" | "EXPIRED";
export type JobResponseStatusLabel = "PENDING" | "ACCEPTED" | "DECLINED" | "WITHDRAWN";

export type JobPostCard = {
  id: string;
  title: string;
  description: string;
  city: string;
  date: string;
  startTime: string;
  durationHours: number;
  budget: number;
  status: JobPostStatusLabel;
  expiresAt: string;
  createdAt: string;
  style?: { id: string; title: string };
  responsesCount: number;
  hasResponded: boolean;
};

export type JobResponseItem = {
  id: string;
  message: string;
  quotedPrice: number;
  status: JobResponseStatusLabel;
  createdAt: string;
  photographer: {
    id: string;
    name: string;
    city: string;
    rating: number;
    imageUrl: string;
  };
};

export type JobPostDetails = JobPostCard & {
  clientName?: string;
  isOwner: boolean;
  canRespond: boolean;
  selectedResponse?: JobResponseItem;
  responses: JobResponseItem[];
};
