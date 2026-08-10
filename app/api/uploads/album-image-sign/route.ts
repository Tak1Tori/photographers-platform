import { NextResponse } from "next/server";
import {
  cloudinaryNotConfiguredMessage,
  configureCloudinary,
  getCloudinaryCredentials
} from "@/lib/cloudinary";
import { getSession } from "@/lib/auth";
import { albumImageMaxBytes, formatMegabytes } from "@/lib/upload-limits";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const imageTransformation = "c_limit,w_1920,h_1920,q_auto:good";

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

  if (!allowedImageTypes.has(contentType) || !size) {
    return NextResponse.json(
      { error: "Поддерживаются изображения JPEG, PNG и WebP." },
      { status: 400 }
    );
  }

  if (size > albumImageMaxBytes) {
    return NextResponse.json(
      {
        error: `Размер изображения не должен превышать ${formatMegabytes(albumImageMaxBytes)} МБ.`
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
      format: "webp",
      timestamp,
      transformation: imageTransformation
    },
    credentials.apiSecret
  );

  return NextResponse.json({
    cloudName: credentials.cloudName,
    apiKey: credentials.apiKey,
    folder,
    format: "webp",
    timestamp,
    transformation: imageTransformation,
    signature
  });
}
