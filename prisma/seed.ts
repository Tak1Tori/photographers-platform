import {
  BookingStatus,
  BookingPaymentStatus,
  BookingType,
  CalendarEventSource,
  CalendarOwnerType,
  HallStatus,
  PaymentProvider,
  PaymentStatus,
  PaymentType,
  PrismaClient,
  ProfileStatus,
  UserRole
} from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const image = (id: string, width = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;

async function main() {
  await prisma.notificationDeliveryLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.availabilityHold.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.availabilityRule.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.photographerPortfolioItem.deleteMany();
  await prisma.studioHall.deleteMany();
  await prisma.studioProfile.deleteMany();
  await prisma.photographerProfile.deleteMany();
  await prisma.style.deleteMany();
  await prisma.user.deleteMany();

  const defaultPasswordHash = await hash("password123", 12);
  const adminPasswordHash = await hash("admin123456", 12);

  const styleSeeds = [
    {
      name: "Business portrait",
      slug: "business-portrait",
      description: "Деловые портреты для LinkedIn, сайта компании и личного бренда.",
      startingPrice: 45000,
      imageUrl: image("photo-1560250097-0b93528c311a")
    },
    {
      name: "Love story",
      slug: "love-story",
      description: "Камерная съемка пары в студии, городе или интерьерной локации.",
      startingPrice: 52000,
      imageUrl: image("photo-1522673607200-164d1b6ce486")
    },
    {
      name: "Family",
      slug: "family",
      description: "Теплые семейные кадры с мягким светом и заранее продуманным сценарием.",
      startingPrice: 50000,
      imageUrl: image("photo-1511895426328-dc8714191300")
    },
    {
      name: "Fashion",
      slug: "fashion",
      description: "Редакционная съемка для моделей, дизайнеров и кампейнов.",
      startingPrice: 70000,
      imageUrl: image("photo-1509631179647-0177331693ae")
    },
    {
      name: "Content shooting",
      slug: "content-shooting",
      description: "Контент для соцсетей, экспертных блогов, запусков и персональных страниц.",
      startingPrice: 42000,
      imageUrl: image("photo-1497366754035-f200968a6e72")
    },
    {
      name: "Product shooting",
      slug: "product-shooting",
      description: "Предметная съемка для маркетплейсов, каталогов, меню и рекламы.",
      startingPrice: 60000,
      imageUrl: image("photo-1523275335684-37898b6baf30")
    }
  ];

  const styles = Object.fromEntries(
    await Promise.all(
      styleSeeds.map(async (style) => {
        const created = await prisma.style.create({ data: style });
        return [created.slug, created];
      })
    )
  );

  await prisma.user.create({
    data: {
      name: "Admin Framely",
      email: "admin@photo-booking.local",
      phone: "+7 700 000 00 01",
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN
    }
  });

  const clientUsers = await Promise.all([
    prisma.user.create({
      data: {
        name: "Тестовый клиент",
        email: "client@photo-booking.local",
        phone: "+7 700 000 00 02",
        passwordHash: defaultPasswordHash,
        role: UserRole.CLIENT
      }
    }),
    prisma.user.create({
      data: {
        name: "Аида Нурлан",
        email: "aida@example.com",
        phone: "+7 701 111 22 33",
        passwordHash: defaultPasswordHash,
        role: UserRole.CLIENT
      }
    }),
    prisma.user.create({
      data: {
        name: "Роман Ким",
        email: "roman@example.com",
        phone: "+7 777 222 44 55",
        passwordHash: defaultPasswordHash,
        role: UserRole.CLIENT
      }
    }),
    prisma.user.create({
      data: {
        name: "Сара Ибраева",
        email: "sara@example.com",
        phone: "+7 705 333 77 88",
        passwordHash: defaultPasswordHash,
        role: UserRole.CLIENT
      }
    })
  ]);

  const photographerSeeds = [
    {
      name: "Арина Ким",
      email: "photographer@photo-booking.local",
      city: "Алматы",
      bio: "Помогает экспертам и командам выглядеть уверенно в кадре.",
      avatarUrl: image("photo-1494790108377-be9c29b29330", 900),
      hourlyRate: 30000,
      rating: 4.9,
      styleSlugs: ["business-portrait", "content-shooting"],
      portfolio: [
        image("photo-1512316609839-ce289d3eba0a", 900),
        image("photo-1544005313-94ddf0286df2", 900),
        image("photo-1506794778202-cad84cf45f1d", 900),
        image("photo-1551836022-d5d88e9218df", 900)
      ]
    },
    {
      name: "Тимур Садыков",
      email: "timur@example.com",
      city: "Алматы",
      bio: "Снимает fashion, lookbook и рекламные кампании.",
      avatarUrl: image("photo-1500648767791-00dcc994a43e", 900),
      hourlyRate: 42000,
      rating: 4.8,
      styleSlugs: ["fashion", "content-shooting", "product-shooting"],
      portfolio: [
        image("photo-1487412720507-e7ab37603c6f", 900),
        image("photo-1529139574466-a303027c1d8b", 900),
        image("photo-1496747611176-843222e1e57c", 900)
      ]
    },
    {
      name: "Майя Волкова",
      email: "maya@example.com",
      city: "Алматы",
      bio: "Делает спокойные семейные и love story съемки.",
      avatarUrl: image("photo-1531123897727-8f129e1688ce", 900),
      hourlyRate: 28000,
      rating: 4.7,
      styleSlugs: ["family", "love-story"],
      portfolio: [
        image("photo-1503454537195-1dcabb73ffb9", 900),
        image("photo-1508214751196-bcfd4ca60f91", 900),
        image("photo-1519689680058-324335c77eba", 900)
      ]
    },
    {
      name: "Данияр Ли",
      email: "daniyar@example.com",
      city: "Алматы",
      bio: "Специализируется на предметной и e-commerce съемке.",
      avatarUrl: image("photo-1507003211169-0a1dd7228f2d", 900),
      hourlyRate: 35000,
      rating: 4.8,
      styleSlugs: ["product-shooting", "business-portrait"],
      portfolio: [
        image("photo-1505740420928-5e560c06d30e", 900),
        image("photo-1491553895911-0055eca6402d", 900),
        image("photo-1512496015851-a90fb38ba796", 900)
      ]
    },
    {
      name: "Лейла Ахметова",
      email: "leila@example.com",
      city: "Алматы",
      bio: "Снимает lifestyle, личный бренд и легкие городские истории.",
      avatarUrl: image("photo-1534528741775-53994a69daeb", 900),
      hourlyRate: 32000,
      rating: 4.6,
      styleSlugs: ["love-story", "content-shooting", "family"],
      portfolio: [
        image("photo-1524504388940-b1c1722653e1", 900),
        image("photo-1524250502761-1ac6f2e30d43", 900),
        image("photo-1488426862026-3ee34a7d66df", 900)
      ]
    }
  ];

  const photographers = [];
  for (const seed of photographerSeeds) {
    const user = await prisma.user.create({
      data: {
        name: seed.name,
        email: seed.email,
        passwordHash: defaultPasswordHash,
        role: UserRole.PHOTOGRAPHER
      }
    });
    const profile = await prisma.photographerProfile.create({
      data: {
        userId: user.id,
        name: seed.name,
        city: seed.city,
        bio: seed.bio,
        avatarUrl: seed.avatarUrl,
        hourlyRate: seed.hourlyRate,
        rating: seed.rating,
        status: ProfileStatus.PUBLISHED,
        styles: {
          connect: seed.styleSlugs.map((slug) => ({ id: styles[slug].id }))
        },
        portfolioItems: {
          create: seed.portfolio.map((imageUrl, index) => ({
            imageUrl,
            title: `${seed.name} portfolio ${index + 1}`,
            description: "Seed portfolio item",
            albumImages: {
              create: seed.portfolio
                .filter((_, albumIndex) => albumIndex !== index)
                .slice(0, 3)
                .map((albumImageUrl, albumIndex) => ({
                  imageUrl: albumImageUrl,
                  sortOrder: albumIndex
                }))
            }
          }))
        }
      },
      include: { styles: true }
    });
    photographers.push(profile);
  }

  const studioOwner = await prisma.user.create({
    data: {
      name: "North Group",
      email: "studio@photo-booking.local",
      passwordHash: defaultPasswordHash,
      role: UserRole.STUDIO_OWNER
    }
  });

  const studioSeeds = [
    {
      name: "North Light",
      city: "Алматы",
      address: "пр. Достык, 91, Самал",
      description: "Светлая студия с большими окнами и нейтральными фонами.",
      rules: "Бронь от 1 часа\nОтмена не позднее чем за 24 часа\nСменная обувь обязательна",
      halls: [
        {
          name: "Daylight Hall",
          description: "Дневной свет, циклорама и гримерка.",
          capacity: 8,
          hourlyRate: 18000,
          imageUrl: image("photo-1604014237800-1c9102c219da"),
          amenities: ["Дневной свет", "Циклорама", "Гримерка"],
          status: HallStatus.ACTIVE
        },
        {
          name: "Cyclorama",
          description: "Белая циклорама и импульсный свет.",
          capacity: 6,
          hourlyRate: 22000,
          imageUrl: image("photo-1600566753190-17f0baa2a6c3"),
          amenities: ["Циклорама", "Импульсный свет", "Wi-Fi"],
          status: HallStatus.ACTIVE
        }
      ]
    },
    {
      name: "Studio Atelier",
      city: "Алматы",
      address: "ул. Байзакова, 280, Бостандык",
      description: "Интерьерная студия для fashion, love story и контента.",
      rules: "Предоплата удерживает слот\nЕда только в lounge-зоне\nПитомцы по согласованию",
      halls: [
        {
          name: "Editorial Room",
          description: "Интерьерная зона с мягким светом.",
          capacity: 10,
          hourlyRate: 22000,
          imageUrl: image("photo-1618221195710-dd6b41faaea6"),
          amenities: ["Интерьер", "Реквизит", "Кофе"],
          status: HallStatus.ACTIVE
        },
        {
          name: "Soft Lounge",
          description: "Камерный зал для семейных и парных съемок.",
          capacity: 5,
          hourlyRate: 19000,
          imageUrl: image("photo-1618220179428-22790b461013"),
          amenities: ["Lounge", "Гримерка", "Парковка"],
          status: HallStatus.ACTIVE
        }
      ]
    },
    {
      name: "White Room",
      city: "Алматы",
      address: "ул. Сатпаева, 30, Алматы",
      description: "Минималистичная студия с белыми стенами и кухонной зоной.",
      rules: "Бронь от 1 часа\nПродление при свободном слоте\nДо 7 человек включено",
      halls: [
        {
          name: "Minimal Space",
          description: "Белый минималистичный зал.",
          capacity: 7,
          hourlyRate: 16000,
          imageUrl: image("photo-1600607687920-4e2a09cf159d"),
          amenities: ["Минимализм", "Кухня", "Детский реквизит"],
          status: HallStatus.ACTIVE
        },
        {
          name: "Kitchen Corner",
          description: "Зона кухни для lifestyle и product shooting.",
          capacity: 4,
          hourlyRate: 14000,
          imageUrl: image("photo-1600566752355-35792bedcfea"),
          amenities: ["Кухня", "Посуда", "Дневной свет"],
          status: HallStatus.ACTIVE
        }
      ]
    }
  ];

  const studios = [];
  for (const seed of studioSeeds) {
    const studio = await prisma.studioProfile.create({
      data: {
        ownerId: studioOwner.id,
        name: seed.name,
        city: seed.city,
        address: seed.address,
        description: seed.description,
        rules: seed.rules,
        status: ProfileStatus.PUBLISHED,
        halls: {
          create: seed.halls.map((hall) => ({
            ...hall,
            amenities: hall.amenities
          }))
        }
      },
      include: { halls: true }
    });
    studios.push(studio);
  }

  const slotDates = [
    new Date("2026-06-15T00:00:00.000Z"),
    new Date("2026-06-17T00:00:00.000Z"),
    new Date("2026-06-19T00:00:00.000Z")
  ];
  for (const photographer of photographers) {
    for (const date of slotDates) {
      await prisma.availabilitySlot.createMany({
        data: ["10:00", "12:00", "16:00"].map((startTime) => ({
          photographerId: photographer.id,
          date,
          startTime,
          endTime: `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, "0")}:00`,
          isAvailable: true
        }))
      });
    }
  }
  for (const studio of studios) {
    for (const hall of studio.halls) {
      for (const date of slotDates) {
        await prisma.availabilitySlot.createMany({
          data: ["10:00", "12:00", "16:00"].map((startTime) => ({
            studioHallId: hall.id,
            date,
            startTime,
            endTime: `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, "0")}:00`,
            isAvailable: true
          }))
        });
      }
    }
  }

  for (const photographer of photographers) {
    await prisma.availabilityRule.createMany({
      data: [1, 2, 3, 4, 5, 6].map((weekday) => ({
        ownerType: CalendarOwnerType.PHOTOGRAPHER,
        photographerProfileId: photographer.id,
        weekday,
        startTime: weekday === 6 ? "11:00" : "10:00",
        endTime: weekday === 6 ? "18:00" : "20:00",
        minDurationMinutes: 60,
        slotStepMinutes: 30,
        bufferAfterMinutes: 30
      }))
    });
  }
  for (const studio of studios) {
    for (const hall of studio.halls) {
      await prisma.availabilityRule.createMany({
        data: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          ownerType: CalendarOwnerType.STUDIO_HALL,
          studioHallId: hall.id,
          weekday,
          startTime: "09:00",
          endTime: "22:00",
          minDurationMinutes: 60,
          slotStepMinutes: 30,
          bufferAfterMinutes: 30
        }))
      });
    }
  }

  await prisma.calendarEvent.createMany({
    data: [
      {
        ownerType: CalendarOwnerType.PHOTOGRAPHER,
        photographerProfileId: photographers[0].id,
        source: CalendarEventSource.MANUAL_BUSY,
        title: "Личная съемка",
        privateNote: "Пример ручной занятости",
        startTime: new Date("2026-06-24T09:00:00.000Z"),
        endTime: new Date("2026-06-24T11:00:00.000Z")
      },
      {
        ownerType: CalendarOwnerType.STUDIO_HALL,
        studioHallId: studios[0].halls[0].id,
        source: CalendarEventSource.MANUAL_BUSY,
        title: "Подготовка декораций",
        privateNote: "Пример занятости зала",
        startTime: new Date("2026-06-25T07:00:00.000Z"),
        endTime: new Date("2026-06-25T09:00:00.000Z")
      }
    ]
  });

  const bookingSeeds = [
    {
      bookingNumber: "BK-1024",
      client: clientUsers[0],
      style: styles["business-portrait"],
      photographer: photographers[0],
      studio: studios[0],
      hall: studios[0].halls[0],
      status: BookingStatus.PENDING,
      durationHours: 2,
      date: new Date("2026-06-15T00:00:00.000Z"),
      startTime: "10:00"
    },
    {
      bookingNumber: "BK-1025",
      client: clientUsers[1],
      style: styles["content-shooting"],
      photographer: photographers[0],
      studio: studios[0],
      hall: studios[0].halls[1],
      status: BookingStatus.CONFIRMED,
      durationHours: 3,
      date: new Date("2026-06-17T00:00:00.000Z"),
      startTime: "12:00"
    },
    {
      bookingNumber: "BK-1026",
      client: clientUsers[2],
      style: styles.fashion,
      photographer: photographers[1],
      studio: studios[1],
      hall: studios[1].halls[0],
      status: BookingStatus.COMPLETED,
      durationHours: 2,
      date: new Date("2026-06-19T00:00:00.000Z"),
      startTime: "16:00"
    }
  ];

  for (const seed of bookingSeeds) {
    const photographerPrice = seed.photographer.hourlyRate * seed.durationHours;
    const studioPrice = seed.hall.hourlyRate * seed.durationHours;
    const serviceFee = Math.round((photographerPrice + studioPrice) * 0.1);
    const totalPrice = photographerPrice + studioPrice + serviceFee;
    const depositAmount = totalPrice <= 10000 ? totalPrice : Math.max(Math.round(totalPrice * 0.2), 10000);
    const booking = await prisma.booking.create({
      data: {
        bookingNumber: seed.bookingNumber,
        clientId: seed.client.id,
        clientName: seed.client.name,
        clientEmail: seed.client.email,
        clientPhone: seed.client.phone ?? "+7 700 000 00 00",
        clientComment: "Seed booking",
        bookingType: BookingType.FULL_SHOOT,
        styleId: seed.style.id,
        photographerId: seed.photographer.id,
        studioId: seed.studio.id,
        studioHallId: seed.hall.id,
        date: seed.date,
        startTime: seed.startTime,
        endTime: `${String(Number(seed.startTime.slice(0, 2)) + seed.durationHours).padStart(2, "0")}:00`,
        durationHours: seed.durationHours,
        photographerPrice,
        studioPrice,
        serviceFee,
        totalPrice,
        depositAmount,
        paidAmount: depositAmount,
        remainingAmount: totalPrice - depositAmount,
        paymentStatus: BookingPaymentStatus.DEPOSIT_PAID,
        status: seed.status,
        payments: {
          create: {
            amount: depositAmount,
            currency: "KZT",
            status: PaymentStatus.PAID,
            provider: PaymentProvider.MOCK,
            type: PaymentType.DEPOSIT,
            providerPaymentId: `seed-${seed.bookingNumber}`
          }
        }
      }
    });
    await prisma.calendarEvent.createMany({
      data: [
        {
          ownerType: CalendarOwnerType.PHOTOGRAPHER,
          photographerProfileId: seed.photographer.id,
          bookingId: booking.id,
          source: CalendarEventSource.PLATFORM_BOOKING,
          title: `Бронь ${booking.bookingNumber}`,
          startTime: new Date(
            `${seed.date.toISOString().slice(0, 10)}T${seed.startTime}:00+05:00`
          ),
          endTime: new Date(
            `${seed.date.toISOString().slice(0, 10)}T${booking.endTime}:00+05:00`
          ),
          bufferAfterMinutes: 30
        },
        {
          ownerType: CalendarOwnerType.STUDIO_HALL,
          studioHallId: seed.hall.id,
          bookingId: booking.id,
          source: CalendarEventSource.PLATFORM_BOOKING,
          title: `Бронь ${booking.bookingNumber}`,
          startTime: new Date(
            `${seed.date.toISOString().slice(0, 10)}T${seed.startTime}:00+05:00`
          ),
          endTime: new Date(
            `${seed.date.toISOString().slice(0, 10)}T${booking.endTime}:00+05:00`
          ),
          bufferAfterMinutes: 30
        }
      ]
    });
  }

  await prisma.booking.create({
    data: {
      bookingNumber: "BK-PHOTO-001",
      clientId: clientUsers[0].id,
      clientName: clientUsers[0].name,
      clientEmail: clientUsers[0].email,
      clientPhone: clientUsers[0].phone ?? "+7 700 000 00 00",
      clientComment: "Seed photographer-only request",
      bookingType: BookingType.PHOTOGRAPHER_ONLY,
      styleId: styles["business-portrait"].id,
      photographerId: photographers[0].id,
      studioId: null,
      studioHallId: null,
      shootType: "Business content",
      shootDescription: "Портреты и короткий контент для соцсетей в офисе клиента.",
      locationType: "client_location",
      city: "Алматы",
      district: "Бостандыкский",
      addressDetails: "Офис клиента, точный адрес после оплаты депозита",
      peopleCount: 2,
      equipmentNeeded: ["portable light", "reflector"],
      specialRequirements: "Нужен компактный сетап без контактов до оплаты.",
      date: new Date("2026-06-22T00:00:00.000Z"),
      startTime: "11:00",
      endTime: "13:00",
      durationHours: 2,
      photographerPrice: photographers[0].hourlyRate * 2,
      studioPrice: 0,
      serviceFee: Math.round(photographers[0].hourlyRate * 2 * 0.1),
      totalPrice: Math.round(photographers[0].hourlyRate * 2 * 1.1),
      depositAmount: Math.max(Math.round(photographers[0].hourlyRate * 2 * 1.1 * 0.2), 10000),
      paidAmount: 0,
      remainingAmount: Math.round(photographers[0].hourlyRate * 2 * 1.1),
      paymentStatus: BookingPaymentStatus.UNPAID,
      status: BookingStatus.PENDING
    }
  });

  const studioOnlyPrice = studios[0].halls[0].hourlyRate * 3;
  const studioOnlyFee = Math.round(studioOnlyPrice * 0.1);
  const studioOnlyTotal = studioOnlyPrice + studioOnlyFee;
  await prisma.booking.create({
    data: {
      bookingNumber: "BK-STUDIO-001",
      clientId: clientUsers[1].id,
      clientName: clientUsers[1].name,
      clientEmail: clientUsers[1].email,
      clientPhone: clientUsers[1].phone ?? "+7 700 000 00 00",
      clientComment: "Seed studio-only request",
      bookingType: BookingType.STUDIO_ONLY,
      styleId: styles["content-shooting"].id,
      photographerId: null,
      studioId: studios[0].id,
      studioHallId: studios[0].halls[0].id,
      rentalPurpose: "Content shooting",
      needsEquipment: true,
      selectedAmenities: ["Cyclorama", "Lighting kit"],
      date: new Date("2026-06-23T00:00:00.000Z"),
      startTime: "13:00",
      endTime: "16:00",
      durationHours: 3,
      photographerPrice: 0,
      studioPrice: studioOnlyPrice,
      serviceFee: studioOnlyFee,
      totalPrice: studioOnlyTotal,
      depositAmount: Math.max(Math.round(studioOnlyTotal * 0.2), 10000),
      paidAmount: 0,
      remainingAmount: studioOnlyTotal,
      paymentStatus: BookingPaymentStatus.UNPAID,
      status: BookingStatus.PENDING
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
