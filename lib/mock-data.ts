import type {
  AvailableSlot,
  AvailabilitySlot,
  Booking,
  MockBooking,
  MockUser,
  Photographer,
  PhotographerProfile,
  PhotoStyle,
  Studio,
  StudioHall,
  StudioProfile
} from "@/lib/types";

export const styles: PhotoStyle[] = [
  {
    id: "business-portrait",
    title: "Business portrait",
    description: "Строгие портреты для LinkedIn, сайта компании и личного бренда.",
    imageUrl:
      "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1200&q=80",
    startingPrice: 45000
  },
  {
    id: "love-story",
    title: "Love story",
    description: "Живая съемка пары в студии, городе или камерной интерьерной локации.",
    imageUrl:
      "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=1200&q=80",
    startingPrice: 52000
  },
  {
    id: "family",
    title: "Family",
    description: "Теплые семейные кадры с мягким светом и заранее продуманным сценарием.",
    imageUrl:
      "https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1200&q=80",
    startingPrice: 50000
  },
  {
    id: "fashion",
    title: "Fashion",
    description: "Редакционная съемка для моделей, дизайнеров, брендов одежды и кампейнов.",
    imageUrl:
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=80",
    startingPrice: 70000
  },
  {
    id: "content-shooting",
    title: "Content shooting",
    description: "Контент для соцсетей, экспертных блогов, запусков и персональных страниц.",
    imageUrl:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80",
    startingPrice: 42000
  },
  {
    id: "product-shooting",
    title: "Product shooting",
    description: "Предметная съемка для маркетплейсов, каталогов, меню и рекламы.",
    imageUrl:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80",
    startingPrice: 60000
  }
];

export const photoStyles = styles;

export const availableSlots: AvailableSlot[] = [
  {
    id: "slot-mon",
    date: "2026-06-15",
    label: "Пн, 15 июня",
    times: ["10:00", "12:00", "16:00"]
  },
  {
    id: "slot-wed",
    date: "2026-06-17",
    label: "Ср, 17 июня",
    times: ["11:00", "14:00", "18:00"]
  },
  {
    id: "slot-fri",
    date: "2026-06-19",
    label: "Пт, 19 июня",
    times: ["09:00", "13:00", "17:00"]
  },
  {
    id: "slot-sat",
    date: "2026-06-20",
    label: "Сб, 20 июня",
    times: ["10:00", "15:00", "19:00"]
  }
];

export const photographers: Photographer[] = [
  {
    id: "arina-kim",
    name: "Арина Ким",
    city: "Алматы",
    bio: "Помогает предпринимателям, экспертам и командам выглядеть уверенно в кадре. Работает с постановкой, светом и быстрым отбором кадров на площадке.",
    specializationIds: ["business-portrait", "content-shooting"],
    pricePerHour: 30000,
    rating: 4.9,
    imageUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80",
    portfolio: [
      "https://images.unsplash.com/photo-1512316609839-ce289d3eba0a?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80"
    ],
    availableSlotIds: ["slot-mon", "slot-wed", "slot-fri"]
  },
  {
    id: "timur-sadykov",
    name: "Тимур Садыков",
    city: "Алматы",
    bio: "Снимает fashion, lookbook и рекламные кампании. Любит графичный свет, чистые композиции и продакшн с продуманным мудбордом.",
    specializationIds: ["fashion", "content-shooting", "product-shooting"],
    pricePerHour: 42000,
    rating: 4.8,
    imageUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80",
    portfolio: [
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80"
    ],
    availableSlotIds: ["slot-wed", "slot-fri", "slot-sat"]
  },
  {
    id: "maya-volkova",
    name: "Майя Волкова",
    city: "Астана",
    bio: "Делает спокойные семейные и love story съемки. Помогает с позированием, одеждой и маршрутом съемочного дня.",
    specializationIds: ["family", "love-story"],
    pricePerHour: 28000,
    rating: 4.7,
    imageUrl:
      "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=900&q=80",
    portfolio: [
      "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=900&q=80"
    ],
    availableSlotIds: ["slot-mon", "slot-wed", "slot-sat"]
  },
  {
    id: "daniyar-lee",
    name: "Данияр Ли",
    city: "Алматы",
    bio: "Специализируется на предметной и e-commerce съемке: чистый фон, аккуратные фактуры, быстрые серии для каталогов.",
    specializationIds: ["product-shooting", "business-portrait"],
    pricePerHour: 35000,
    rating: 4.8,
    imageUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=80",
    portfolio: [
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=900&q=80"
    ],
    availableSlotIds: ["slot-mon", "slot-fri", "slot-sat"]
  }
];

export const studios: Studio[] = [
  {
    id: "north-light",
    name: "North Light",
    hallName: "Daylight Hall",
    city: "Алматы",
    district: "Самал",
    address: "пр. Достык, 91, Самал",
    description:
      "Светлая студия с большими окнами, циклорамой и нейтральными фонами для портретов, контента и предметной съемки.",
    pricePerHour: 18000,
    capacity: 8,
    rating: 4.9,
    imageUrl:
      "https://images.unsplash.com/photo-1604014237800-1c9102c219da?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1604014237800-1c9102c219da?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80"
    ],
    amenities: ["Дневной свет", "Циклорама", "Гримерка", "Wi-Fi", "Парковка"],
    rules: ["Бронь от 1 часа", "Отмена не позднее чем за 24 часа", "Сменная обувь обязательна"],
    halls: [
      { name: "Daylight Hall", capacity: 8, pricePerHour: 18000 },
      { name: "Cyclorama", capacity: 6, pricePerHour: 22000 }
    ],
    suitableStyleIds: ["business-portrait", "content-shooting", "product-shooting"],
    availableSlotIds: ["slot-mon", "slot-wed", "slot-fri"]
  },
  {
    id: "studio-atelier",
    name: "Studio Atelier",
    hallName: "Editorial Room",
    city: "Алматы",
    district: "Бостандык",
    address: "ул. Байзакова, 280, Бостандык",
    description:
      "Интерьерная студия с несколькими зонами, импульсным светом и реквизитом для fashion и love story съемок.",
    pricePerHour: 22000,
    capacity: 10,
    rating: 4.8,
    imageUrl:
      "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80"
    ],
    amenities: ["Интерьерные зоны", "Импульсный свет", "Реквизит", "Гримерка", "Кофе"],
    rules: ["Предоплата удерживает слот", "Еда и напитки только в lounge-зоне", "Питомцы по согласованию"],
    halls: [
      { name: "Editorial Room", capacity: 10, pricePerHour: 22000 },
      { name: "Soft Lounge", capacity: 5, pricePerHour: 19000 }
    ],
    suitableStyleIds: ["fashion", "love-story", "family", "content-shooting"],
    availableSlotIds: ["slot-wed", "slot-fri", "slot-sat"]
  },
  {
    id: "white-room",
    name: "White Room",
    hallName: "Minimal Space",
    city: "Астана",
    district: "Есиль",
    address: "пр. Кабанбай батыра, 46, Есиль",
    description:
      "Минималистичная студия с белыми стенами, мягкой мебелью и зоной кухни для семейных и lifestyle-съемок.",
    pricePerHour: 16000,
    capacity: 7,
    rating: 4.6,
    imageUrl:
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1200&q=80"
    ],
    amenities: ["Минимализм", "Кухонная зона", "Парковка", "Детский реквизит", "Гримерка"],
    rules: ["Бронь от 1 часа", "Продление возможно при свободном слоте", "До 7 человек включено"],
    halls: [
      { name: "Minimal Space", capacity: 7, pricePerHour: 16000 },
      { name: "Kitchen Corner", capacity: 4, pricePerHour: 14000 }
    ],
    suitableStyleIds: ["family", "love-story", "business-portrait"],
    availableSlotIds: ["slot-mon", "slot-wed", "slot-sat"]
  }
];

export const mockUsers: MockUser[] = [
  {
    id: "client-aida",
    name: "Аида Нурлан",
    email: "aida@example.com",
    phone: "+7 701 111 22 33",
    role: "CLIENT"
  },
  {
    id: "client-roman",
    name: "Роман Ким",
    email: "roman@example.com",
    phone: "+7 777 222 44 55",
    role: "CLIENT"
  },
  {
    id: "client-sara",
    name: "Сара Ибраева",
    email: "sara@example.com",
    role: "CLIENT"
  }
];

export const mockPhotographerProfile: PhotographerProfile = {
  id: "profile-arina",
  photographerId: "arina-kim",
  name: "Арина Ким",
  city: "Алматы",
  avatarUrl: photographers[0]?.imageUrl,
  specializationIds: ["business-portrait", "content-shooting"],
  pricePerHour: 30000,
  bio: "Помогаю экспертам и командам выглядеть уверенно в кадре. Работаю с постановкой, светом и быстрым отбором кадров на площадке.",
  status: "Published",
  rating: 4.9,
  portfolio: photographers[0]?.portfolio ?? []
};

export const mockStudioHalls: StudioHall[] = [
  {
    id: "hall-daylight",
    name: "Daylight Hall",
    capacity: 8,
    pricePerHour: 18000,
    amenities: ["Дневной свет", "Циклорама", "Гримерка"],
    status: "Active",
    imageUrl:
      "https://images.unsplash.com/photo-1604014237800-1c9102c219da?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "hall-cyclorama",
    name: "Cyclorama",
    capacity: 6,
    pricePerHour: 22000,
    amenities: ["Белая циклорама", "Импульсный свет", "Wi-Fi"],
    status: "Active",
    imageUrl:
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=80"
  }
];

export const mockStudioProfile: StudioProfile = {
  id: "profile-north-light",
  studioId: "north-light",
  name: "North Light",
  city: "Алматы",
  address: "пр. Достык, 91, Самал",
  description:
    "Светлая студия с большими окнами, циклорамой и нейтральными фонами для портретов, контента и предметной съемки.",
  rules: ["Бронь от 1 часа", "Отмена не позднее чем за 24 часа", "Сменная обувь обязательна"],
  status: "Published",
  halls: mockStudioHalls
};

export const mockAvailability: AvailabilitySlot[] = [
  { id: "mon-10", day: "Понедельник", time: "10:00", enabled: true },
  { id: "mon-12", day: "Понедельник", time: "12:00", enabled: true },
  { id: "mon-16", day: "Понедельник", time: "16:00", enabled: false },
  { id: "wed-11", day: "Среда", time: "11:00", enabled: true },
  { id: "wed-14", day: "Среда", time: "14:00", enabled: true },
  { id: "wed-18", day: "Среда", time: "18:00", enabled: false },
  { id: "fri-09", day: "Пятница", time: "09:00", enabled: true },
  { id: "fri-13", day: "Пятница", time: "13:00", enabled: false },
  { id: "fri-17", day: "Пятница", time: "17:00", enabled: true }
];

export const mockBookings: Booking[] = [
  {
    id: "BK-1024",
    clientId: "client-aida",
    clientName: "Аида Нурлан",
    bookingType: "FULL_SHOOT",
    photographerId: "arina-kim",
    studioId: "north-light",
    styleId: "business-portrait",
    hallName: "Daylight Hall",
    date: "2026-06-15",
    time: "10:00",
    durationHours: 2,
    photographerTotal: 60000,
    studioTotal: 36000,
    serviceFee: 9600,
    totalAmount: 105600,
    depositAmount: 21120,
    paidAmount: 21120,
    remainingAmount: 84480,
    paymentStatus: "DEPOSIT_PAID",
    status: "Pending"
  },
  {
    id: "BK-1025",
    clientId: "client-roman",
    clientName: "Роман Ким",
    bookingType: "FULL_SHOOT",
    photographerId: "arina-kim",
    studioId: "north-light",
    styleId: "content-shooting",
    hallName: "Cyclorama",
    date: "2026-06-17",
    time: "14:00",
    durationHours: 3,
    photographerTotal: 90000,
    studioTotal: 66000,
    serviceFee: 15600,
    totalAmount: 171600,
    depositAmount: 34320,
    paidAmount: 34320,
    remainingAmount: 137280,
    paymentStatus: "DEPOSIT_PAID",
    status: "Confirmed"
  },
  {
    id: "BK-1026",
    clientId: "client-sara",
    clientName: "Сара Ибраева",
    bookingType: "FULL_SHOOT",
    photographerId: "timur-sadykov",
    studioId: "studio-atelier",
    styleId: "fashion",
    hallName: "Editorial Room",
    date: "2026-06-19",
    time: "17:00",
    durationHours: 2,
    photographerTotal: 84000,
    studioTotal: 44000,
    serviceFee: 12800,
    totalAmount: 140800,
    depositAmount: 28160,
    paidAmount: 28160,
    remainingAmount: 112640,
    paymentStatus: "PAID",
    status: "Completed"
  },
  {
    id: "BK-1027",
    clientId: "client-aida",
    clientName: "Аида Нурлан",
    bookingType: "FULL_SHOOT",
    photographerId: "maya-volkova",
    studioId: "white-room",
    styleId: "family",
    hallName: "Minimal Space",
    date: "2026-06-20",
    time: "15:00",
    durationHours: 1,
    photographerTotal: 28000,
    studioTotal: 16000,
    serviceFee: 4400,
    totalAmount: 48400,
    depositAmount: 10000,
    paidAmount: 0,
    remainingAmount: 48400,
    paymentStatus: "UNPAID",
    status: "Cancelled"
  }
];

export const mockAdminStats = {
  platformCommissionRate: 0.1,
  photographerCommissionRate: 0.05,
  studioCommissionRate: 0.05
};

export function getStyleById(id?: string) {
  return styles.find((style) => style.id === id);
}

export function getPhotographerById(id?: string) {
  return photographers.find((photographer) => photographer.id === id);
}

export function getStudioById(id?: string) {
  return studios.find((studio) => studio.id === id);
}

export function getStyleTitles(styleIds: string[]) {
  return styleIds
    .map((styleId) => styles.find((style) => style.id === styleId)?.title)
    .filter(Boolean) as string[];
}

export function getSlots(slotIds: string[]) {
  return availableSlots.filter((slot) => slotIds.includes(slot.id));
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat("ru-KZ", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0
  }).format(value);
}
