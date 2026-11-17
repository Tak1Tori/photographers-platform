import { redirect } from "next/navigation";

export default async function StudioConfirmationWaitingPage({
  params
}: {
  params: Promise<{ requestId: string }>;
}) {
  await params;
  redirect("/photographers?mode=booking");
}
