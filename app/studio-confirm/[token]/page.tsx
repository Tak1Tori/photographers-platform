import { redirect } from "next/navigation";

export default async function StudioConfirmationTokenPage({
  params
}: {
  params: { token: string };
}) {
  void params;
  redirect("/photographers?mode=booking");
}
