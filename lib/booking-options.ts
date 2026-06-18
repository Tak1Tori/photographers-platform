export const SHOOT_TYPES = [
  { value: "PERSONAL", label: "Персональная съемка" },
  { value: "EVENT", label: "Мероприятие" },
  { value: "WEDDING", label: "Свадьба" },
  { value: "BIRTHDAY", label: "День рождения" },
  { value: "BUSINESS", label: "Бизнес" },
  { value: "CONTENT", label: "Контент" },
  { value: "PRODUCT", label: "Предметная съемка" },
  { value: "REPORTAGE", label: "Репортаж" },
  { value: "OTHER", label: "Другое" }
] as const;

export const LOCATION_TYPES = [
  { value: "OUTDOOR", label: "На улице" },
  { value: "CLIENT_HOME", label: "Дома у клиента" },
  { value: "OFFICE", label: "В офисе" },
  { value: "RESTAURANT", label: "В ресторане" },
  { value: "EVENT_PLACE", label: "На площадке события" },
  { value: "STUDIO_ALREADY_BOOKED", label: "Студия уже забронирована" },
  { value: "NEED_STUDIO_HELP", label: "Нужна помощь со студией" },
  { value: "OTHER", label: "Другое" }
] as const;

export const EQUIPMENT_OPTIONS = [
  { value: "NO_SPECIAL_EQUIPMENT", label: "На усмотрение фотографа" },
  { value: "LIGHTING", label: "Свет" },
  { value: "BACKDROP", label: "Фон" },
  { value: "PRODUCT_TABLE", label: "Предметный стол" },
  { value: "TRIPOD", label: "Штатив" },
  { value: "VIDEO_LIGHT", label: "Видео-свет" },
  { value: "OTHER", label: "Другое" }
] as const;

export const RENTAL_PURPOSES = [
  { value: "PERSONAL_SHOOT", label: "Персональная съемка" },
  { value: "COMMERCIAL_SHOOT", label: "Коммерческая съемка" },
  { value: "CONTENT_SHOOT", label: "Контент-съемка" },
  { value: "PRODUCT_SHOOT", label: "Предметная съемка" },
  { value: "VIDEO_SHOOT", label: "Видео" },
  { value: "CASTING", label: "Кастинг" },
  { value: "WORKSHOP", label: "Воркшоп" },
  { value: "EVENT", label: "Событие" },
  { value: "OTHER", label: "Другое" }
] as const;

export const STUDIO_EQUIPMENT_OPTIONS = [
  { value: "LIGHTING", label: "Свет" },
  { value: "BACKDROP", label: "Фон" },
  { value: "CYCLORAMA", label: "Циклорама" },
  { value: "MAKEUP_TABLE", label: "Гримерный стол" },
  { value: "CHANGING_ROOM", label: "Раздевалка" },
  { value: "SOFTBOX", label: "Софтбокс" },
  { value: "TRIPOD", label: "Штатив" },
  { value: "STEAMER", label: "Отпариватель" },
  { value: "SPEAKERS", label: "Колонки" },
  { value: "OTHER", label: "Другое" }
] as const;

export type ShootType = (typeof SHOOT_TYPES)[number]["value"];
export type LocationType = (typeof LOCATION_TYPES)[number]["value"];
export type EquipmentNeeded = (typeof EQUIPMENT_OPTIONS)[number]["value"];
export type RentalPurpose = (typeof RENTAL_PURPOSES)[number]["value"];
export type StudioEquipment = (typeof STUDIO_EQUIPMENT_OPTIONS)[number]["value"];

export function getOptionLabel<T extends string>(
  options: ReadonlyArray<{ value: T; label: string }>,
  value?: string | null
) {
  return options.find((option) => option.value === value)?.label ?? value ?? "-";
}
