export interface CoverCrop {
  x?: number | null;
  y?: number | null;
  width?: number | null;
  height?: number | null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clean(value: number | null | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function getCoverCropPresentation(crop: CoverCrop) {
  const width = clamp(clean(crop.width, 100), 10, 100);
  const height = clamp(clean(crop.height, 100), 10, 100);
  const x = clamp(clean(crop.x, 0), 0, 100 - width);
  const y = clamp(clean(crop.y, 0), 0, 100 - height);
  const hasCrop = width < 99.9 || height < 99.9 || x > 0.1 || y > 0.1;

  return {
    objectPosition: `${x + width / 2}% ${y + height / 2}%`,
    transform: hasCrop
      ? `scale(${Math.min(1.35, Math.max(1.05, 100 / Math.max(width, height)))})`
      : undefined
  };
}
