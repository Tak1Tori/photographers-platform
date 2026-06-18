import Link from "next/link";
import { Camera, Images, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const options = [
  {
    title: "Фотосессия под ключ",
    description: "Выберите стиль, фотографа, студию и удобное время.",
    href: "/booking/new?type=FULL_SHOOT",
    cta: "Начать подбор",
    icon: Camera
  },
  {
    title: "Забронировать фотографа",
    description: "Выберите фотографа для съемки на вашей локации, мероприятии или в студии.",
    href: "/photographers?mode=booking",
    cta: "Выбрать фотографа",
    icon: UserRound
  },
  {
    title: "Забронировать студию",
    description: "Выберите студию или зал для своей съемки.",
    href: "/studios?mode=booking",
    cta: "Выбрать студию",
    icon: Images
  }
];

export function BookingTypeSelector() {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <Card key={option.href}>
            <CardContent className="grid h-full gap-5 p-6">
              <span className="flex size-11 items-center justify-center rounded-md bg-secondary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-xl font-semibold tracking-normal">{option.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{option.description}</p>
              </div>
              <Button asChild className="mt-auto">
                <Link href={option.href}>{option.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
