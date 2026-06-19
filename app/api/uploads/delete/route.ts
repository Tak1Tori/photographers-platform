import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteImageFromCloudinary } from "@/lib/uploads";

export async function POST(request: Request) {
  const session = await getSession();

  if (
    !session?.user ||
    !["PHOTOGRAPHER", "ADMIN"].includes(session.user.role)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { publicId } = (await request.json()) as { publicId?: string };
  if (!publicId?.startsWith("supabase:photographers/albums/")) {
    return NextResponse.json({ error: "Invalid media id" }, { status: 400 });
  }

  await deleteImageFromCloudinary(publicId);
  return NextResponse.json({ success: true });
}
