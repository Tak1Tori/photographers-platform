import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  mockPhotographerProfile,
  mockStudioProfile
} from "@/lib/mock-data";
import type {
  DashboardAvailabilitySlot,
  PhotographerProfile,
  PortfolioItem,
  StudioProfile
} from "@/lib/types";

interface DevStore {
  photographerProfile: PhotographerProfile;
  portfolioItems: PortfolioItem[];
  photographerSlots: DashboardAvailabilitySlot[];
  studioProfile: StudioProfile;
  studioSlots: DashboardAvailabilitySlot[];
}

const storePath = path.join(process.cwd(), ".data", "dev-store.json");

const defaultStore: DevStore = {
  photographerProfile: mockPhotographerProfile,
  portfolioItems: mockPhotographerProfile.portfolio.map((imageUrl, index) => ({
    id: `dev-portfolio-${index + 1}`,
    imageUrl,
    title: `Portfolio ${index + 1}`,
    description: "Dev portfolio item",
    albumImages: []
  })),
  photographerSlots: [],
  studioProfile: mockStudioProfile,
  studioSlots: []
};

export async function getDevStore(): Promise<DevStore> {
  try {
    const raw = await readFile(storePath, "utf-8");
    return { ...defaultStore, ...JSON.parse(raw) };
  } catch {
    return defaultStore;
  }
}

export async function updateDevStore(updater: (store: DevStore) => DevStore | Promise<DevStore>) {
  const current = await getDevStore();
  const next = await updater(current);
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(next, null, 2));
  return next;
}
