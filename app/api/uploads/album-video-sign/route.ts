import { NextResponse } from "next/server";
import {
  cloudinaryNotConfiguredMessage,
  configureCloudinary,
  getCloudinaryCredentials
} from "@/lib/cloudinary";
import { getSession } from "@/lib/auth";
import { albumVideoMaxBytes, formatMegabytes } from "@/lib/upload-limits";

const allowedVideoTypes = new Set([
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

  if (!allowedVideoTypes.has(contentType) || !size) {
    return NextResponse.json(
      { error: "Поддерживаются видео MP4, WebM и MOV." },
      { status: 400 }
    );
  }

  if (size > albumVideoMaxBytes) {
    return NextResponse.json(
      {
        error: `Размер видео не должен превышать ${formatMegabytes(albumVideoMaxBytes)} МБ.`
      },
      { status: 400 }
    );
  }

  const credentials = getCloudinaryCredentials();

  if (!credentials) {
    return NextResponse.json(
      { error: cloudinaryNotConfiguredMessage },
      { status: 503 }
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `photographers/albums/${session.user.id}`;
  const client = configureCloudinary();
  const signature = client.utils.api_sign_request(
    {
      folder,
      timestamp
    },
    credentials.apiSecret
  );

  return NextResponse.json({
    cloudName: credentials.cloudName,
    apiKey: credentials.apiKey,
    folder,
    timestamp,
    signature
  });
}
