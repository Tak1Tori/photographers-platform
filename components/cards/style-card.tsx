import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/mock-data";
import type { PhotoStyle } from "@/lib/types";

interface StyleCardProps {
  style: PhotoStyle;
  ctaLabel?: string;
}

export function StyleCard({ style, ctaLabel = "Выбрать стиль" }: StyleCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[4/3]">
        <Image src={style.imageUrl} alt={style.title} fill className="object-cover" />
      </div>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold">{style.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {style.description}
            </p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="font-medium">от {formatPrice(style.startingPrice)}</span>
          <Button asChild size="sm">
            <Link href={`/photographers?style=${style.id}`}>
              {ctaLabel}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
