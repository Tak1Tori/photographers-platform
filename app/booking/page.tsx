import { redirect } from "next/navigation";

export default function BookingPage() {
  redirect("/photographers?mode=booking");
}
