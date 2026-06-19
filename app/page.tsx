import { BookingScenarios } from "@/components/home/booking-scenarios";
import { HeroSection } from "@/components/home/hero-section";
import { MarketplaceSlider } from "@/components/home/marketplace-slider";
import { getPhotographers } from "@/lib/data/photographers";
import { getStudios } from "@/lib/data/studios";

export default async function HomePage() {
  const [photographers, studios] = await Promise.all([
    getPhotographers(),
    getStudios()
  ]);

  return (
    <>
      <HeroSection />
      <BookingScenarios />
      <div className="border-b border-border">
        <MarketplaceSlider
          title="Фотографы"
          type="photographers"
          items={photographers}
          viewAllHref="/photographers?mode=booking"
        />
        <MarketplaceSlider
          title="Студии"
          type="studios"
          items={studios}
          viewAllHref="/studios?mode=booking"
        />
      </div>
    </>
  );
}
