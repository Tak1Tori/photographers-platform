import { redirect } from "next/navigation";

export default async function StudioConfirmationTokenPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  await params;
  redirect("/photographers?mode=booking");
}
