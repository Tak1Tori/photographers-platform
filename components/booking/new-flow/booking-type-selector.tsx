import Link from "next/link";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const options = [
  {
    title: "Забронировать фотографа",
    description: "Выберите фотографа для съемки на вашей локации или мероприятии.",
    href: "/photographers?mode=booking",
    cta: "Выбрать фотографа",
    icon: UserRound
  }
];

export function BookingTypeSelector() {
  return (
    <div className="grid max-w-md gap-5">
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
