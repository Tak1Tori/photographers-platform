import { BookingStatus as PrismaBookingStatus } from "@prisma/client";
import { getAllBookings } from "@/lib/data/bookings";
import { canUseDatabase } from "@/lib/data/db";
import { prisma } from "@/lib/prisma";

const cancelledBookingStatuses = [
  PrismaBookingStatus.CANCELLED,
  PrismaBookingStatus.CANCELLED_BY_CLIENT,
  PrismaBookingStatus.CANCELLED_BY_PROVIDER,
  PrismaBookingStatus.CANCELLED_BY_PLATFORM,
  PrismaBookingStatus.NO_SHOW_CLIENT,
  PrismaBookingStatus.NO_SHOW_PROVIDER
];

const emptyAdminStats = {
  totalBookings: 0,
  pendingBookings: 0,
  activePhotographers: 0,
  activeStudios: 0,
  gmv: 0,
  serviceFee: 0,
  platformRevenue: 0
};

export async function getAdminStats() {
  if (!canUseDatabase()) return emptyAdminStats;

  const [totalBookings, pendingBookings, activePhotographers, activeStudios, amounts] = await Promise.all([
    prisma.booking.count(),
    prisma.booking.count({
      where: {
        status: {
          in: [
            PrismaBookingStatus.PENDING,
            PrismaBookingStatus.PENDING_PLATFORM_FEE,
            PrismaBookingStatus.RESCHEDULE_REQUESTED
          ]
        }
      }
    }),
    prisma.photographerProfile.count({
      where: { status: "PUBLISHED", user: { role: "PHOTOGRAPHER" } }
    }),
    prisma.studioProfile.count({ where: { status: "PUBLISHED" } }),
    prisma.booking.aggregate({
      where: { status: { notIn: cancelledBookingStatuses } },
      _sum: {
        totalPrice: true,
        serviceFee: true
      }
    })
  ]);

  const gmv = amounts._sum.totalPrice ?? 0;
  const serviceFee = amounts._sum.serviceFee ?? 0;

  return {
    totalBookings,
    pendingBookings,
    activePhotographers,
    activeStudios,
    gmv,
    serviceFee,
    platformRevenue: serviceFee
  };
}

export async function getPhotographerDashboardStats(photographerId: string) {
  const bookings = (await getAllBookings()).filter(
    (booking) => booking.photographerId === photographerId
  );
  return {
    activeBookings: bookings.filter((booking) =>
      ["Pending", "Confirmed"].includes(booking.status)
    ).length,
    pendingBookings: bookings.filter((booking) => booking.status === "Pending").length,
    monthlyRevenue: bookings.reduce((sum, booking) => sum + booking.photographerTotal, 0)
  };
}

export async function getStudioDashboardStats(studioId: string) {
  const bookings = (await getAllBookings()).filter((booking) => booking.studioId === studioId);
  return {
    activeBookings: bookings.filter((booking) =>
      ["Pending", "Confirmed"].includes(booking.status)
    ).length,
    monthlyRevenue: bookings.reduce((sum, booking) => sum + booking.studioTotal, 0)
  };
}
