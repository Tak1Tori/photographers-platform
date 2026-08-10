import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  albumImageMaxBytes,
  albumVideoMaxBytes,
  formatMegabytes
} from "@/lib/upload-limits";

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime"
]);

export async function POST(request: Request) {
  const session = await getSession();

  if (
    !session?.user ||
    !["PHOTOGRAPHER", "ADMIN"].includes(session.user.role)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    fileName?: string;
    contentType?: string;
    size?: number;
  };
  const contentType = body.contentType ?? "";
  const size = Number(body.size ?? 0);

  if (!allowedTypes.has(contentType) || !size) {
    return NextResponse.json(
      { error: "Поддерживаются JPEG, PNG, WebP, MP4, WebM и MOV." },
      { status: 400 }
    );
  }

  const isVideo = contentType.startsWith("video/");
  const maxBytes = isVideo ? albumVideoMaxBytes : albumImageMaxBytes;

  if (size > maxBytes) {
    return NextResponse.json(
      {
        error: isVideo
          ? `Размер видео не должен превышать ${formatMegabytes(albumVideoMaxBytes)} МБ.`
          : `Размер изображения не должен превышать ${formatMegabytes(albumImageMaxBytes)} МБ.`
      },
      { status: 400 }
    );
  }

  const extension = extensionFor(contentType, body.fileName);
  const filePath = `photographers/albums/${session.user.id}/${randomUUID()}.${extension}`;
  const response = await fetch(process.env.SUPABASE_STORAGE_ENDPOINT!, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-framely-action": "sign",
      "x-framely-upload-secret": process.env.SUPABASE_STORAGE_SECRET!
    },
    body: JSON.stringify({ filePath, contentType, size })
  });
  const result = (await response.json()) as {
    path?: string;
    token?: string;
    publicUrl?: string;
    publicId?: string;
    error?: string;
  };

  if (!response.ok || !result.path || !result.token) {
    return NextResponse.json(
      { error: result.error ?? "Не удалось подготовить загрузку." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ...result,
    supabaseUrl: process.env.SUPABASE_PROJECT_URL,
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    bucket: "framely-media"
  });
}

function extensionFor(contentType: string, fileName?: string) {
  const byType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov"
  };
  return byType[contentType] ?? fileName?.split(".").pop() ?? "bin";
}
