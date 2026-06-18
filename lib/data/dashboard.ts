import { getAllBookings } from "@/lib/data/bookings";
import { canUseDatabase } from "@/lib/data/db";
import { prisma } from "@/lib/prisma";
import { photographers, studios } from "@/lib/mock-data";

export async function getAdminStats() {
  const bookings = await getAllBookings();
  const gmv = bookings
    .filter((booking) => booking.status !== "Cancelled")
    .reduce((sum, booking) => sum + booking.totalAmount, 0);
  const serviceFee = bookings.reduce((sum, booking) => sum + booking.serviceFee, 0);
  let activePhotographers = photographers.length;
  let activeStudios = studios.length;

  try {
    if (!canUseDatabase()) {
      throw new Error("DATABASE_URL is not configured");
    }

    const [photographerCount, studioCount] = await Promise.all([
      prisma.photographerProfile.count({ where: { status: "PUBLISHED" } }),
      prisma.studioProfile.count({ where: { status: "PUBLISHED" } })
    ]);
    activePhotographers = photographerCount || activePhotographers;
    activeStudios = studioCount || activeStudios;
  } catch {
    // Fallback keeps dashboards renderable before DATABASE_URL/migrations are configured.
  }

  return {
    totalBookings: bookings.length,
    pendingBookings: bookings.filter((booking) => booking.status === "Pending").length,
    activePhotographers,
    activeStudios,
    gmv,
    serviceFee,
    estimatedPlatformRevenue: serviceFee
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
