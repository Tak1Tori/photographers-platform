import { redirect } from "next/navigation";

export default async function StudioConfirmationWaitingPage({
  params
}: {
  params: { requestId: string };
}) {
  void params;
  redirect("/photographers?mode=booking");
}
