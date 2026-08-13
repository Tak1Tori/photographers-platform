import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { configureCloudinary } from "../lib/cloudinary";

const albumPrefix = "photographers/albums/";
const minimumAssetAgeMs = 48 * 60 * 60 * 1000;
const productionProjectRef = "qiwlwbxznhuwcwpftaak";
const developmentProjectRef = "issqfaxisgqpeofiwdoe";

type AuditEnvironment = "development" | "production";
type CloudinaryResource = {
  public_id?: string;
  bytes?: number;
  created_at?: string;
  resource_type?: "image" | "video";
};

type OrphanCandidate = Required<
  Pick<CloudinaryResource, "public_id" | "bytes" | "created_at">
> & {
  resource_type: "image" | "video";
};

type AuditOptions = {
  environment: AuditEnvironment;
  shouldDelete: boolean;
};

function loadEnvironmentFile(fileName: string) {
  const filePath = path.join(process.cwd(), fileName);
  if (!existsSync(filePath)) return;

  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "").trim();
  }
}

function getOptions(): AuditOptions {
  const environmentValue = process.argv
    .slice(2)
    .find((argument) => argument.startsWith("--env="))
    ?.slice("--env=".length);
  const environment =
    environmentValue === "development" || environmentValue === "production"
      ? environmentValue
      : null;

  if (!environment) {
    throw new Error(
      "Укажите окружение явно: --env=development или --env=production. По умолчанию скрипт ничего не делает."
    );
  }

  return {
    environment,
    shouldDelete: process.argv.includes("--delete")
  };
}

function getProjectRefFromConnectionUri(databaseUrl: string) {
  let connectionUri: URL;

  try {
    connectionUri = new URL(databaseUrl);
  } catch {
    throw new Error("PRODUCTION_DATABASE_URL должен быть корректным PostgreSQL connection URI.");
  }

  const detectedRefs = new Set<string>();
  const hostnameParts = connectionUri.hostname.toLowerCase().split(".");

  for (const projectRef of [productionProjectRef, developmentProjectRef]) {
    if (hostnameParts.includes(projectRef)) {
      detectedRefs.add(projectRef);
    }
  }

  let username = "";
  try {
    username = decodeURIComponent(connectionUri.username).toLowerCase();
  } catch {
    throw new Error("PRODUCTION_DATABASE_URL содержит некорректное имя пользователя.");
  }

  const poolerMatch = username.match(/^postgres\.([a-z0-9]+)$/);
  if (poolerMatch) {
    detectedRefs.add(poolerMatch[1]);
  }

  if (detectedRefs.has(developmentProjectRef)) {
    throw new Error("PRODUCTION_DATABASE_URL указывает на dev Supabase project. Audit остановлен до подключения.");
  }

  if (detectedRefs.size !== 1 || !detectedRefs.has(productionProjectRef)) {
    throw new Error(
      "Не удалось однозначно подтвердить production project ref в PRODUCTION_DATABASE_URL. Audit остановлен до подключения."
    );
  }

  return productionProjectRef;
}

function createAuditPrismaClient(options: AuditOptions) {
  if (options.environment === "production") {
    const databaseUrl = process.env.PRODUCTION_DATABASE_URL;
    const configuredProjectRef = process.env.PRODUCTION_SUPABASE_PROJECT_REF;

    if (!databaseUrl || !configuredProjectRef) {
      throw new Error(
        "Для production audit обязательны PRODUCTION_DATABASE_URL и PRODUCTION_SUPABASE_PROJECT_REF."
      );
    }

    if (configuredProjectRef !== productionProjectRef) {
      throw new Error("PRODUCTION_SUPABASE_PROJECT_REF не совпадает с ожидаемым production project ref.");
    }

    getProjectRefFromConnectionUri(databaseUrl);

    return new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl
        }
      }
    });
  }

  if (options.shouldDelete) {
    throw new Error("Удаление разрешено только в подтверждённом production audit.");
  }

  return new PrismaClient();
}

function normalizePublicId(value?: string | null) {
  return String(value ?? "")
    .trim()
    .replace(/^cloudinary:(?:image|video):/, "");
}

function getAssetAgeMs(createdAt?: string) {
  if (!createdAt) return null;

  const timestamp = Date.parse(createdAt);
  return Number.isFinite(timestamp) ? Math.max(Date.now() - timestamp, 0) : null;
}

function isOlderThan48Hours(createdAt?: string) {
  const ageMs = getAssetAgeMs(createdAt);
  return ageMs !== null && ageMs >= minimumAssetAgeMs;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
}

function formatMegabytes(bytes: number) {
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
}

function formatAge(createdAt: string) {
  const ageMs = getAssetAgeMs(createdAt);
  if (ageMs === null) return "unknown age";

  const hours = Math.floor(ageMs / (60 * 60 * 1000));
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

async function listAlbumResources(resourceType: "image" | "video") {
  const client = configureCloudinary();
  const resources: OrphanCandidate[] = [];
  let nextCursor: string | undefined;

  do {
    const page = (await client.api.resources({
      resource_type: resourceType,
      type: "upload",
      prefix: albumPrefix,
      max_results: 500,
      ...(nextCursor ? { next_cursor: nextCursor } : {})
    })) as { resources?: CloudinaryResource[]; next_cursor?: string };

    for (const resource of page.resources ?? []) {
      if (!resource.public_id || !resource.public_id.startsWith(albumPrefix)) continue;
      resources.push({
        public_id: resource.public_id,
        bytes: resource.bytes ?? 0,
        created_at: resource.created_at ?? "",
        resource_type: resourceType
      });
    }

    nextCursor = page.next_cursor;
  } while (nextCursor);

  return resources;
}

async function main() {
  const options = getOptions();
  loadEnvironmentFile(".env");
  loadEnvironmentFile(".env.local");
  const prisma = createAuditPrismaClient(options);

  try {
    console.log(`Environment: ${options.environment}`);
    if (options.environment === "production") {
      console.log(`Project ref: ${productionProjectRef}`);
    }
    console.log(`Mode: ${options.shouldDelete ? "DELETE" : "DRY RUN"}`);

    const [albumImages, portfolioItems, imageAssets, videoAssets] = await Promise.all([
      prisma.photographerPortfolioImage.findMany({
        select: { imagePublicId: true }
      }),
      prisma.photographerPortfolioItem.findMany({
        select: { imagePublicId: true }
      }),
      listAlbumResources("image"),
      listAlbumResources("video")
    ]);

    const referencedPublicIds = new Set(
      [...albumImages, ...portfolioItems]
        .map((record) => normalizePublicId(record.imagePublicId))
        .filter((publicId) => publicId.startsWith(albumPrefix))
    );
    const assets = [...imageAssets, ...videoAssets];
    const referencedAssets = assets.filter((asset) => referencedPublicIds.has(asset.public_id));
    const unreferencedAssets = assets.filter((asset) => !referencedPublicIds.has(asset.public_id));
    const orphanCandidates = unreferencedAssets.filter((asset) => isOlderThan48Hours(asset.created_at));
    const recentUnreferencedAssets = unreferencedAssets.filter((asset) => {
      const ageMs = getAssetAgeMs(asset.created_at);
      return ageMs !== null && ageMs < minimumAssetAgeMs;
    });
    const orphanBytes = orphanCandidates.reduce((total, asset) => total + asset.bytes, 0);

    console.log(`Cloudinary album assets: ${assets.length}`);
    console.log(`Referenced: ${referencedAssets.length}`);
    console.log(`Orphan candidates (>48h): ${orphanCandidates.length}`);
    console.log(`Ignored recent unreferenced (<48h): ${recentUnreferencedAssets.length}`);
    console.log(`Potential reclaim: ${formatMegabytes(orphanBytes)}`);

    if (orphanCandidates.length) {
      console.log("Orphan candidates:");
      orphanCandidates.forEach((asset) => {
        console.log(
          `- ${asset.public_id} (${asset.resource_type}, age ${formatAge(asset.created_at)}, ${formatBytes(asset.bytes)})`
        );
      });
    }

    if (recentUnreferencedAssets.length) {
      console.log("Ignored recent unreferenced assets:");
      recentUnreferencedAssets.forEach((asset) => {
        console.log(
          `- ${asset.public_id} (${asset.resource_type}, age ${formatAge(asset.created_at)}, ${formatBytes(asset.bytes)})`
        );
      });
    }

    if (!options.shouldDelete || !orphanCandidates.length) return;

    const client = configureCloudinary();
    let deleted = 0;
    const failures: string[] = [];
    for (const asset of orphanCandidates) {
      try {
        const result = await client.uploader.destroy(asset.public_id, {
          resource_type: asset.resource_type,
          invalidate: true
        });
        if (result.result === "ok" || result.result === "not found") {
          deleted += 1;
        } else {
          failures.push(`${asset.public_id}: ${result.result}`);
        }
      } catch (error) {
        failures.push(
          `${asset.public_id}: ${error instanceof Error ? error.message : "unknown error"}`
        );
      }
    }

    console.log(`Deleted: ${deleted}`);
    if (failures.length) {
      console.error("Delete failures:");
      failures.forEach((failure) => console.error(`- ${failure}`));
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    `Cloudinary orphan audit failed: ${error instanceof Error ? error.message : "unknown error"}`
  );
  process.exitCode = 1;
});
