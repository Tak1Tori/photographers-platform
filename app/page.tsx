import { BookingScenarios } from "@/components/home/booking-scenarios";
import { BookingTypesOverview } from "@/components/home/booking-types-overview";
import { HeroSection } from "@/components/home/hero-section";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <BookingScenarios />
      <BookingTypesOverview />
    </>
  );
}
