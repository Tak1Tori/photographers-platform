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
  const isAdmin = session.user.role === "ADMIN";
  const validSupabaseMedia = publicId?.startsWith(
    `supabase:photographers/albums/${session.user.id}/`
  );
  const validCloudinaryVideo = publicId?.startsWith(
    `cloudinary:video:photographers/albums/${session.user.id}/`
  );
  const validCloudinaryImage = publicId?.startsWith(
    `cloudinary:image:photographers/albums/${session.user.id}/`
  );
  const adminAlbumMedia =
    isAdmin &&
    (publicId?.startsWith("supabase:photographers/albums/") ||
      publicId?.startsWith("cloudinary:video:photographers/albums/") ||
      publicId?.startsWith("cloudinary:image:photographers/albums/"));

  if (
    !validSupabaseMedia &&
    !validCloudinaryVideo &&
    !validCloudinaryImage &&
    !adminAlbumMedia
  ) {
    return NextResponse.json({ error: "Invalid media id" }, { status: 400 });
  }

  await deleteImageFromCloudinary(publicId);
  return NextResponse.json({ success: true });
}
