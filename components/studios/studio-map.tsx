"use client";

import { useState } from "react";
import { ExternalLink, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StudioMapProps {
  title: string;
  address: string;
  city?: string;
  twoGisUrl?: string;
  twoGisEmbedUrl?: string;
  compact?: boolean;
  variant?: "card" | "location";
  className?: string;
}

export function StudioMap({
  title,
  address,
  city,
  twoGisUrl,
  compact = false,
  variant = "card",
  className
}: StudioMapProps) {
  const [zoom, setZoom] = useState(16);
  const embedUrl = buildGoogleMapsEmbedUrl(address, city, zoom);
  const twoGisExternalUrl = twoGisUrl || buildTwoGisSearchUrl(address, city);

  if (variant === "location") {
    return (
      <section className={cn("rounded-lg border border-border bg-card/55 p-4 md:p-5", className)}>
        <div className="mb-4">
          <h2 className="text-xl font-semibold tracking-normal md:text-2xl">
            Локация
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground md:text-base">
            {formatAddressParts(address, city).map((part, index) => (
              <span key={`${part}-${index}`} className="inline-flex items-center gap-2">
                {index > 0 ? <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" /> : null}
                <span>{part}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="relative h-[190px] touch-auto overflow-hidden rounded-md border border-border bg-secondary md:h-[240px]">
          <iframe
            title={`Карта студии ${title}`}
            src={embedUrl}
            className="absolute inset-0 size-full touch-auto border-0 brightness-[0.92] contrast-[0.94] saturate-[0.82]"
            loading="lazy"
            allow="fullscreen; geolocation"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="pointer-events-none absolute inset-0 bg-emerald-950/10 mix-blend-multiply" />
          <MapZoomControls zoom={zoom} onZoomChange={setZoom} />
          <a
            href={twoGisExternalUrl}
            target="_blank"
            rel="noreferrer"
            className="absolute bottom-3 left-3 rounded-md border border-border bg-background/90 px-3 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur transition-colors hover:border-primary/60 hover:text-primary"
          >
            Сколько займет дорога
          </a>
        </div>
        <a
          href={twoGisExternalUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          Показать в 2GIS
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      </section>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>
      <div className={cn("relative touch-auto bg-secondary", compact ? "h-40" : "h-72")}>
        <iframe
          title={`Карта студии ${title}`}
          src={embedUrl}
          className="absolute inset-0 size-full touch-auto border-0 brightness-[0.92] contrast-[0.94] saturate-[0.82]"
          loading="lazy"
          allow="fullscreen; geolocation"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
        <div className="pointer-events-none absolute inset-0 bg-emerald-950/10 mix-blend-multiply" />
        <MapZoomControls zoom={zoom} onZoomChange={setZoom} compact={compact} />
      </div>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          <p className="mt-1 break-words text-sm text-muted-foreground">{address}</p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <a href={twoGisExternalUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" aria-hidden="true" />
            Открыть 2GIS
          </a>
        </Button>
      </div>
    </div>
  );
}

function MapZoomControls({
  zoom,
  onZoomChange,
  compact = false
}: {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute left-3 top-3 z-10 grid overflow-hidden rounded-md border border-border bg-background/90 shadow-lg backdrop-blur",
        compact && "left-2 top-2"
      )}
    >
      <button
        type="button"
        className="inline-flex size-9 items-center justify-center text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-45"
        aria-label="Приблизить карту"
        disabled={zoom >= 20}
        onClick={() => onZoomChange(Math.min(20, zoom + 1))}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
      <span className="h-px bg-border" aria-hidden="true" />
      <button
        type="button"
        className="inline-flex size-9 items-center justify-center text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-45"
        aria-label="Отдалить карту"
        disabled={zoom <= 11}
        onClick={() => onZoomChange(Math.max(11, zoom - 1))}
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function buildGoogleMapsEmbedUrl(address: string, city?: string, zoom = 16) {
  const query = encodeURIComponent([address, city].filter(Boolean).join(", "));
  return `https://www.google.com/maps?q=${query}&z=${zoom}&output=embed`;
}

function buildTwoGisSearchUrl(address: string, city?: string) {
  const query = encodeURIComponent([address, city].filter(Boolean).join(", "));
  return `https://2gis.kz/search/${query}`;
}

function formatAddressParts(address: string, city?: string) {
  const parts = [
    city,
    ...address
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
  ].filter(Boolean) as string[];

  return Array.from(new Set(parts));
}
