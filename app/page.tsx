import type { Metadata } from "next";
import { connection } from "next/server";
import { BenefitsSlider } from "@/components/home/benefits-slider";
import { HeroSection } from "@/components/home/hero-section";
import { MarketplaceSlider } from "@/components/home/marketplace-slider";
import { getEditors } from "@/lib/data/editors";
import { getPhotographers } from "@/lib/data/photographers";
import { getStyles } from "@/lib/data/styles";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://framelyphoto.com/"
  },
  openGraph: {
    title: "Framely | Фотографы Алматы",
    description: "Находите фотографов в Алматы, смотрите портфолио и выбирайте удобное время для съёмки на Framely.",
    url: "/",
    siteName: "Framely",
    locale: "ru_KZ",
    type: "website"
  }
};

const HOME_GROUP_LIMIT = 3;

function compareGroups<T extends { photographers: unknown[]; title: string }>(a: T, b: T) {
  return b.photographers.length - a.photographers.length || a.title.localeCompare(b.title, "ru");
}

export default async function HomePage() {
  await connection();
  const [photographers, styles, editors] = await Promise.all([
    getPhotographers(),
    getStyles(),
    getEditors()
  ]);

  const photographerGroups = styles
    .map((style) => {
      return {
        id: style.id,
        title: style.title,
        photographers: photographers.filter((photographer) =>
          photographer.specializationIds.some((tag) => tag === style.id)
        )
      };
    })
    .filter((group) => group.photographers.length > 0)
    .sort(compareGroups);

  const limitedGroups = photographerGroups.slice(0, HOME_GROUP_LIMIT);

  const groups =
    limitedGroups.length > 0
      ? limitedGroups
      : photographers.length > 0
        ? [{ id: "", title: "Фотографы", photographers }]
        : [];

  return (
    <>
      <HeroSection />
      <BenefitsSlider />
      {groups.map((group) => (
        <div key={group.id || "all-photographers"} className="border-b border-border">
          <MarketplaceSlider
            title={group.title}
            type="photographers"
            items={group.photographers}
            viewAllHref={
              group.id
                ? `/photographers?mode=booking&style=${group.id}`
                : "/photographers?mode=booking"
            }
          />
        </div>
      ))}
      {editors.length > 0 ? (
        <div className="border-b border-border">
          <MarketplaceSlider title="Монтажеры" type="editors" items={editors} viewAllHref="/editors" />
        </div>
      ) : null}
    </>
  );
}
