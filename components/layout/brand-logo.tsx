import Image from "next/image";

type BrandLogoProps = {
  className: string;
  priority?: boolean;
  sizes: string;
};

export function BrandLogo({ className, priority = false, sizes }: BrandLogoProps) {
  return (
    <span className={`relative block shrink-0 aspect-[25/14] ${className}`}>
      <Image
        src="/brand/framely-logo-dark.png"
        alt=""
        fill
        priority={priority}
        sizes={sizes}
        className="brand-logo-dark object-contain"
      />
      <Image
        src="/brand/framely-logo-light.png"
        alt=""
        fill
        priority={priority}
        sizes={sizes}
        className="brand-logo-light object-contain"
      />
    </span>
  );
}
