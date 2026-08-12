export function formatServiceDuration(durationMinutes: number) {
  if (durationMinutes % 60 === 0) {
    const hours = durationMinutes / 60;
    return `${hours} ${hours === 1 ? "час" : hours < 5 ? "часа" : "часов"}`;
  }

  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return hours > 0 ? `${hours} ч ${minutes} мин` : `${minutes} мин`;
}

export function getPhotographerDisplayPrice(pricePerHour: number, lowestServicePrice?: number) {
  return lowestServicePrice ?? pricePerHour;
}
