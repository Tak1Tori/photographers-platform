import { redirect } from "next/navigation";

export default function StudiosPage() {
  redirect("/photographers?mode=booking");
}
