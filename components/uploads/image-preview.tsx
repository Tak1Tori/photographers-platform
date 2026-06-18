"use client";

import Image from "next/image";

const fallback =
  "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80";

export function ImagePreview({
  src,
  alt,
  aspect = "aspect-[4/3]"
}: {
  src?: string;
  alt: string;
  aspect?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-lg border border-border bg-secondary ${aspect}`}>
      <Image
        src={src || fallback}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, 420px"
        className="object-cover"
      />
    </div>
  );
}
