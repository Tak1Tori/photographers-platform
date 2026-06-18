"use client";

import { useState } from "react";
import Image from "next/image";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const placeholder =
  "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80";

export function PortfolioGrid({ initialImages }: { initialImages: string[] }) {
  const [images, setImages] = useState(initialImages);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <CardTitle>Портфолио</CardTitle>
          <Button size="sm" onClick={() => setImages((current) => [placeholder, ...current])}>
            <ImagePlus className="size-4" aria-hidden="true" />
            Add photo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {images.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Добавьте первое фото в портфолио.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {images.map((imageUrl, index) => (
              <div key={`${imageUrl}-${index}`} className="group relative aspect-[4/5] overflow-hidden rounded-lg">
                <Image src={imageUrl} alt="Portfolio item" fill className="object-cover" />
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute right-2 top-2 opacity-0 group-hover:opacity-100"
                  onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
