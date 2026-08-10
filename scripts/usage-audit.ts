import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import path from "path";

type CountResult = {
  count: number;
};

type SizeStats = {
  count: number;
  totalBytes: number | null;
  avgBytes: number | null;
  minBytes: number | null;
  maxBytes: number | null;
  source: string;
  note?: string;
};

type ColumnInfo = {
  table_name: string;
  column_name: string;
  data_type: string;
};

type CodeMatch = {
  file: string;
  line: number;
  text: string;
};

type CloudinaryResource = {
  public_id?: string;
  bytes?: number;
  format?: string;
  resource_type?: string;
  created_at?: string;
};

type CloudinaryResourcesResponse = {
  resources?: CloudinaryResource[];
  next_cursor?: string;
  error?: { message?: string };
};

type CloudinaryUsageResponse = {
  storage?: { usage?: number; limit?: number };
  credits?: { usage?: number; limit?: number };
  bandwidth?: { usage?: number; limit?: number };
  transformations?: { usage?: number; limit?: number };
  requests?: number;
  objects?: { usage?: number; limit?: number };
  error?: { message?: string };
};

const prisma = new PrismaClient();
const root = process.cwd();
const GiB = 1024 ** 3;
const MiB = 1024 ** 2;

const freePlanDefaults = {
  supabaseDbBytes: 500 * MiB,
  supabaseStorageBytes: 1 * GiB,
  cloudinaryStorageBytes: 25 * GiB
};

const ignoredDirs = new Set([
  ".git",
  ".next",
  "node_modules",
  ".vercel",
  ".agents",
  ".data",
  "public/uploads"
]);

function loadEnvFile(fileName: string) {
  const filePath = path.join(root, fileName);
  if (!existsSync(filePath)) return;

  const text = readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function toNumber(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

function formatBytes(bytes?: number | null) {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "н/д";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MiB) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < GiB) return `${(bytes / MiB).toFixed(2)} MB`;
  return `${(bytes / GiB).toFixed(2)} GB`;
}

function formatNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "н/д";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

function percent(used: number | null | undefined, limit: number) {
  if (!used) return "0%";
  return `${((used / limit) * 100).toFixed(2)}%`;
}

function escapeIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function makeStats(values: number[], source: string, note?: string): SizeStats {
  const cleanValues = values.filter((value) => Number.isFinite(value) && value >= 0);
  const totalBytes = cleanValues.reduce((sum, value) => sum + value, 0);

  return {
    count: cleanValues.length,
    totalBytes,
    avgBytes: cleanValues.length ? totalBytes / cleanValues.length : null,
    minBytes: cleanValues.length ? Math.min(...cleanValues) : null,
    maxBytes: cleanValues.length ? Math.max(...cleanValues) : null,
    source,
    note
  };
}

async function safeQuery<T>(label: string, sql: string): Promise<T[] | null> {
  try {
    return await prisma.$queryRawUnsafe<T[]>(sql);
  } catch (error) {
    console.log(`- ${label}: не удалось прочитать (${messageFrom(error)})`);
    return null;
  }
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function getDatabaseSize() {
  const rows = await safeQuery<{ bytes: bigint | number; pretty: string }>(
    "Supabase/Postgres размер базы",
    `select pg_database_size(current_database()) as bytes, pg_size_pretty(pg_database_size(current_database())) as pretty`
  );

  if (!rows?.[0]) return null;

  return {
    bytes: toNumber(rows[0].bytes),
    pretty: rows[0].pretty
  };
}

async function getLargestTables() {
  return safeQuery<{
    table_name: string;
    bytes: bigint | number;
    pretty: string;
  }>(
    "размер таблиц",
    `
      select
        relname as table_name,
        pg_total_relation_size(c.oid) as bytes,
        pg_size_pretty(pg_total_relation_size(c.oid)) as pretty
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
      order by pg_total_relation_size(c.oid) desc
      limit 12
    `
  );
}

async function getSupabaseStorageUsage() {
  return safeQuery<{
    object_count: bigint | number;
    bytes: bigint | number | null;
    objects_without_size: bigint | number;
  }>(
    "Supabase Storage usage",
    `
      select
        count(*) as object_count,
        coalesce(
          sum(
            coalesce(
              nullif(metadata->>'size', '')::bigint,
              nullif(metadata->>'contentLength', '')::bigint,
              nullif(metadata->>'Content-Length', '')::bigint
            )
          ),
          0
        ) as bytes,
        count(*) filter (
          where coalesce(
            metadata->>'size',
            metadata->>'contentLength',
            metadata->>'Content-Length'
          ) is null
        ) as objects_without_size
      from storage.objects
    `
  );
}

async function getColumns() {
  const rows = await safeQuery<ColumnInfo>(
    "схема public",
    `
      select table_name, column_name, data_type
      from information_schema.columns
      where table_schema = 'public'
      order by table_name, ordinal_position
    `
  );

  return rows ?? [];
}

function groupColumns(columns: ColumnInfo[]) {
  const map = new Map<string, ColumnInfo[]>();
  for (const column of columns) {
    const list = map.get(column.table_name) ?? [];
    list.push(column);
    map.set(column.table_name, list);
  }
  return map;
}

function hasColumn(tableColumns: ColumnInfo[] | undefined, name: string) {
  return Boolean(tableColumns?.some((column) => column.column_name === name));
}

async function countRows(table: string, where = "true") {
  const rows = await safeQuery<CountResult>(
    `count ${table}`,
    `select count(*)::int as count from ${escapeIdentifier(table)} where ${where}`
  );
  return rows?.[0]?.count ?? 0;
}

async function getPortfolioStats(columnsByTable: Map<string, ColumnInfo[]>) {
  const itemTable = "PhotographerPortfolioItem";
  const imageTable = "PhotographerPortfolioImage";
  const itemColumns = columnsByTable.get(itemTable);
  const imageColumns = columnsByTable.get(imageTable);

  if (!itemColumns || !imageColumns) {
    return {
      portfolioImageCount: 0,
      portfolioAlbumCount: 0,
      photographerCount: 0,
      avgPhotosAllPhotographers: null,
      avgPhotosPhotographersWithPortfolio: null,
      dbStats: makeStats([], "database", "Таблицы портфолио не найдены.")
    };
  }

  const imageWhere = hasColumn(imageColumns, "mediaType")
    ? `${escapeIdentifier("mediaType")} = 'IMAGE'`
    : "true";

  const portfolioImageCount = await countRows(imageTable, imageWhere);
  const portfolioAlbumCount = await countRows(itemTable);
  const photographerCount = await countRows("PhotographerProfile");

  const avgRows = await safeQuery<{
    avg_all: number | string | null;
    avg_non_empty: number | string | null;
  }>(
    "среднее фото на фотографа",
    `
      with per_photographer as (
        select
          p.id,
          count(i.id)::int as photo_count
        from "PhotographerProfile" p
        left join "PhotographerPortfolioItem" album on album."photographerId" = p.id
        left join "PhotographerPortfolioImage" i
          on i."portfolioItemId" = album.id
          and i."mediaType" = 'IMAGE'
        group by p.id
      )
      select
        avg(photo_count)::float as avg_all,
        avg(photo_count) filter (where photo_count > 0)::float as avg_non_empty
      from per_photographer
    `
  );

  const sizeColumn = imageColumns.find((column) =>
    /^(bytes|fileSize|originalBytes|sizeBytes|optimizedBytes)$/i.test(column.column_name)
  );

  let dbStats = makeStats(
    [],
    "database",
    "В таблице PhotographerPortfolioImage нет поля bytes/fileSize/originalBytes/sizeBytes, поэтому вес фото из базы посчитать нельзя."
  );

  if (sizeColumn) {
    const statsRows = await safeQuery<{
      count: number;
      total_bytes: bigint | number | null;
      avg_bytes: number | string | null;
      min_bytes: bigint | number | null;
      max_bytes: bigint | number | null;
    }>(
      "размеры портфолио из БД",
      `
        select
          count(*)::int as count,
          sum(${escapeIdentifier(sizeColumn.column_name)}) as total_bytes,
          avg(${escapeIdentifier(sizeColumn.column_name)}) as avg_bytes,
          min(${escapeIdentifier(sizeColumn.column_name)}) as min_bytes,
          max(${escapeIdentifier(sizeColumn.column_name)}) as max_bytes
        from "PhotographerPortfolioImage"
        where ${imageWhere}
          and ${escapeIdentifier(sizeColumn.column_name)} is not null
      `
    );

    const row = statsRows?.[0];
    if (row) {
      dbStats = {
        count: toNumber(row.count),
        totalBytes: row.total_bytes === null ? null : toNumber(row.total_bytes),
        avgBytes: row.avg_bytes === null ? null : Number(row.avg_bytes),
        minBytes: row.min_bytes === null ? null : toNumber(row.min_bytes),
        maxBytes: row.max_bytes === null ? null : toNumber(row.max_bytes),
        source: `database:${sizeColumn.column_name}`
      };
    }
  }

  return {
    portfolioImageCount,
    portfolioAlbumCount,
    photographerCount,
    avgPhotosAllPhotographers:
      avgRows?.[0]?.avg_all === null || avgRows?.[0]?.avg_all === undefined
        ? null
        : Number(avgRows[0].avg_all),
    avgPhotosPhotographersWithPortfolio:
      avgRows?.[0]?.avg_non_empty === null || avgRows?.[0]?.avg_non_empty === undefined
        ? null
        : Number(avgRows[0].avg_non_empty),
    dbStats
  };
}

async function getCloudinaryUsage() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return {
      usage: null,
      imageStats: makeStats(
        [],
        "cloudinary",
        "Cloudinary Admin API недоступен: не заданы CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY и/или CLOUDINARY_API_SECRET."
      ),
      resourcesScanned: 0,
      truncated: false
    };
  }

  const auth = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
  const baseUrl = `https://api.cloudinary.com/v1_1/${cloudName}`;

  let usage: CloudinaryUsageResponse | null = null;
  try {
    const response = await fetch(`${baseUrl}/usage`, {
      headers: { Authorization: auth }
    });
    const json = (await response.json()) as CloudinaryUsageResponse;
    if (!response.ok) {
      throw new Error(json.error?.message ?? response.statusText);
    }
    usage = json;
  } catch (error) {
    console.log(`- Cloudinary usage: не удалось прочитать (${messageFrom(error)})`);
  }

  const imageBytes: number[] = [];
  const portfolioPrefixes = ["photographers/portfolio", "photographers/albums"];
  let nextCursor: string | undefined;
  let pages = 0;
  const maxPages = Number(process.env.CLOUDINARY_AUDIT_MAX_PAGES ?? 20);
  let truncated = false;

  try {
    do {
      const url = new URL(`${baseUrl}/resources/image/upload`);
      url.searchParams.set("max_results", "500");
      url.searchParams.set("prefix", "photographers");
      if (nextCursor) url.searchParams.set("next_cursor", nextCursor);

      const response = await fetch(url, {
        headers: { Authorization: auth }
      });
      const json = (await response.json()) as CloudinaryResourcesResponse;

      if (!response.ok) {
        throw new Error(json.error?.message ?? response.statusText);
      }

      for (const resource of json.resources ?? []) {
        const publicId = resource.public_id ?? "";
        if (!portfolioPrefixes.some((prefix) => publicId.startsWith(prefix))) continue;
        if (typeof resource.bytes === "number") imageBytes.push(resource.bytes);
      }

      nextCursor = json.next_cursor;
      pages += 1;
      truncated = Boolean(nextCursor && pages >= maxPages);
    } while (nextCursor && pages < maxPages);
  } catch (error) {
    return {
      usage,
      imageStats: makeStats(
        imageBytes,
        "cloudinary",
        `Список Cloudinary resources прочитан частично или недоступен: ${messageFrom(error)}`
      ),
      resourcesScanned: imageBytes.length,
      truncated
    };
  }

  return {
    usage,
    imageStats: makeStats(
      imageBytes,
      "cloudinary",
      truncated
        ? `Сканирование ограничено CLOUDINARY_AUDIT_MAX_PAGES=${maxPages}; часть ресурсов не учтена.`
        : undefined
    ),
    resourcesScanned: imageBytes.length,
    truncated
  };
}

function walkFiles(dir: string, result: string[] = []) {
  for (const entry of readdirSync(dir)) {
    if (ignoredDirs.has(entry)) continue;

    const filePath = path.join(dir, entry);
    let stat;
    try {
      stat = statSync(filePath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      walkFiles(filePath, result);
      continue;
    }

    if (filePath === __filename) continue;

    if (/\.(ts|tsx|js|jsx|prisma)$/.test(entry)) {
      result.push(filePath);
    }
  }
  return result;
}

function scanCode(pattern: RegExp, limit = 40): CodeMatch[] {
  const matches: CodeMatch[] = [];
  const files = walkFiles(root);

  for (const file of files) {
    const relative = path.relative(root, file);
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        matches.push({
          file: relative,
          line: index + 1,
          text: line.trim()
        });
      }
    });
    if (matches.length >= limit) break;
  }

  return matches.slice(0, limit);
}

function printMatches(title: string, matches: CodeMatch[]) {
  console.log(`\n${title}`);
  if (!matches.length) {
    console.log("- не найдено");
    return;
  }

  for (const match of matches) {
    console.log(`- ${match.file}:${match.line} — ${match.text}`);
  }
}

function estimateCapacity({
  averagePhotosPerPhotographer,
  averagePhotoBytes,
  dbBytes,
  supabaseStorageBytes,
  cloudinaryStorageBytes
}: {
  averagePhotosPerPhotographer: number | null;
  averagePhotoBytes: number | null;
  dbBytes: number | null;
  supabaseStorageBytes: number | null;
  cloudinaryStorageBytes: number | null;
}) {
  console.log("\nПрогноз по free-планам");
  console.log(
    "- Лимиты взяты как ориентир: Supabase DB 500 MB, Supabase Storage 1 GB, Cloudinary Storage 25 GB. Перед продом проверьте актуальную страницу тарифов."
  );

  if (!averagePhotosPerPhotographer || !averagePhotoBytes) {
    console.log(
      "- Нельзя посчитать прогноз по фото: нет среднего веса фото или среднего количества фото на фотографа."
    );
    return;
  }

  const scenarios = [10, 50, 100, 500];
  const dbUsed = dbBytes ?? 0;
  const supabaseStorageUsed = supabaseStorageBytes ?? 0;
  const cloudinaryStorageUsed = cloudinaryStorageBytes ?? 0;

  for (const photographers of scenarios) {
    const projectedPhotoBytes =
      photographers * averagePhotosPerPhotographer * averagePhotoBytes;
    const projectedCloudinary = cloudinaryStorageUsed + projectedPhotoBytes;

    console.log(
      `- ${photographers} фотографов: примерно ${formatBytes(projectedPhotoBytes)} новых portfolio photos; Cloudinary storage ${percent(projectedCloudinary, freePlanDefaults.cloudinaryStorageBytes)} лимита; Supabase Storage остается около текущего ${percent(supabaseStorageUsed, freePlanDefaults.supabaseStorageBytes)} лимита, если новые portfolio images идут в Cloudinary; DB сейчас ${percent(dbUsed, freePlanDefaults.supabaseDbBytes)} лимита.`
    );
  }
}

function printStats(label: string, stats: SizeStats) {
  console.log(`\n${label}`);
  console.log(`- источник: ${stats.source}`);
  console.log(`- файлов с размером: ${stats.count}`);
  console.log(`- суммарно: ${formatBytes(stats.totalBytes)}`);
  console.log(`- средний вес: ${formatBytes(stats.avgBytes)}`);
  console.log(`- минимум: ${formatBytes(stats.minBytes)}`);
  console.log(`- максимум: ${formatBytes(stats.maxBytes)}`);
  if (stats.note) console.log(`- примечание: ${stats.note}`);
}

function getDbSizeColumns(columnsByTable: Map<string, ColumnInfo[]>) {
  const found: string[] = [];
  for (const [table, columns] of Array.from(columnsByTable.entries())) {
    for (const column of columns) {
      if (/bytes|fileSize|originalBytes|sizeBytes|optimizedBytes/i.test(column.column_name)) {
        found.push(`${table}.${column.column_name} (${column.data_type})`);
      }
    }
  }
  return found;
}

async function main() {
  loadEnvFile(".env");
  loadEnvFile(".env.local");

  console.log("Framely usage audit");
  console.log("Режим: read-only. Скрипт не меняет и не удаляет данные.\n");

  const dbSize = await getDatabaseSize();
  if (dbSize) {
    console.log("Supabase/Postgres");
    console.log(`- размер базы: ${dbSize.pretty} (${formatBytes(dbSize.bytes)})`);
    console.log(`- free DB 500 MB: ${percent(dbSize.bytes, freePlanDefaults.supabaseDbBytes)}`);
  } else {
    console.log("Supabase/Postgres");
    console.log("- размер базы: н/д, не удалось выполнить pg_database_size().");
  }

  const tableRows = await getLargestTables();
  if (tableRows?.length) {
    console.log("- самые крупные таблицы:");
    for (const row of tableRows) {
      console.log(`  · ${row.table_name}: ${row.pretty}`);
    }
  }

  const storageRows = await getSupabaseStorageUsage();
  const supabaseStorageBytes =
    storageRows?.[0]?.bytes === null || storageRows?.[0]?.bytes === undefined
      ? null
      : toNumber(storageRows[0].bytes);
  if (storageRows?.[0]) {
    const objectCount = toNumber(storageRows[0].object_count);
    const objectsWithoutSize = toNumber(storageRows[0].objects_without_size);
    console.log("\nSupabase Storage");
    console.log(`- объектов: ${formatNumber(objectCount)}`);
    console.log(`- занято: ${formatBytes(supabaseStorageBytes)}`);
    console.log(
      `- free Storage 1 GB: ${percent(supabaseStorageBytes, freePlanDefaults.supabaseStorageBytes)}`
    );
    if (objectCount > 0 && (objectsWithoutSize > 0 || !supabaseStorageBytes)) {
      console.log(
        `- предупреждение: у ${objectsWithoutSize} объектов нет размера или размер не удалось прочитать из storage.objects.metadata. Значение 0 B может означать не пустое хранилище, а отсутствие пригодных size-метаданных.`
      );
    }
  } else {
    console.log("\nSupabase Storage");
    console.log(
      "- usage не получен. Возможно, роль DATABASE_URL не имеет прав на schema storage или Supabase Storage не подключен к этому проекту."
    );
  }

  const columns = await getColumns();
  const columnsByTable = groupColumns(columns);
  const sizeColumns = getDbSizeColumns(columnsByTable);

  console.log("\nПоля размера файлов в базе");
  if (sizeColumns.length) {
    sizeColumns.forEach((column) => console.log(`- ${column}`));
  } else {
    console.log("- не найдено полей bytes/fileSize/originalBytes/sizeBytes/optimizedBytes.");
  }

  const portfolioStats = await getPortfolioStats(columnsByTable);
  console.log("\nПортфолио фотографов");
  console.log(`- фотографов в базе: ${portfolioStats.photographerCount}`);
  console.log(`- альбомов: ${portfolioStats.portfolioAlbumCount}`);
  console.log(`- фото в альбомах: ${portfolioStats.portfolioImageCount}`);
  console.log(
    `- среднее фото на фотографа: ${formatNumber(portfolioStats.avgPhotosAllPhotographers)}`
  );
  console.log(
    `- среднее фото на фотографа с портфолио: ${formatNumber(portfolioStats.avgPhotosPhotographersWithPortfolio)}`
  );
  printStats("Вес фото портфолио из базы", portfolioStats.dbStats);

  const cloudinary = await getCloudinaryUsage();
  console.log("\nCloudinary");
  if (cloudinary.usage) {
    const storageUsage = cloudinary.usage.storage?.usage ?? null;
    const storageLimit = cloudinary.usage.storage?.limit ?? null;
    console.log(`- storage usage: ${formatBytes(storageUsage)}`);
    if (storageLimit) {
      console.log(`- storage limit: ${formatBytes(storageLimit)}`);
      console.log(`- storage used: ${percent(storageUsage, storageLimit)}`);
    } else {
      console.log("- storage limit: н/д");
    }
    if (cloudinary.usage.credits) {
      console.log(
        `- credits: ${formatNumber(cloudinary.usage.credits.usage)} из ${formatNumber(cloudinary.usage.credits.limit)}`
      );
    }
    if (cloudinary.usage.bandwidth) {
      console.log(`- bandwidth usage: ${formatBytes(cloudinary.usage.bandwidth.usage)}`);
    }
    if (cloudinary.usage.transformations) {
      console.log(
        `- transformations: ${formatNumber(cloudinary.usage.transformations.usage)}`
      );
    }
  } else {
    console.log(
      "- usage не получен. Нужны CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET и доступ к Admin API."
    );
  }
  printStats("Вес portfolio images Cloudinary", cloudinary.imageStats);

  const bestAveragePhotoBytes =
    portfolioStats.dbStats.avgBytes ?? cloudinary.imageStats.avgBytes ?? null;

  estimateCapacity({
    averagePhotosPerPhotographer: portfolioStats.avgPhotosAllPhotographers,
    averagePhotoBytes: bestAveragePhotoBytes,
    dbBytes: dbSize?.bytes ?? null,
    supabaseStorageBytes,
    cloudinaryStorageBytes: cloudinary.usage?.storage?.usage ?? cloudinary.imageStats.totalBytes
  });

  printMatches(
    "Где находится upload фотографий",
    scanCode(/uploadImageToCloudinary|uploadToSignedUrl|SUPABASE_STORAGE_ENDPOINT|uploader\.upload_stream|type="file"|new File\(/, 80)
  );
  printMatches(
    "Где стоит лимит 25 MB",
    scanCode(/25\s*\*\s*1024\s*\*\s*1024|25\s*MB|25\s*МБ|до \{maxSizeMb\} МБ/, 60)
  );
  printMatches(
    "Оптимизации изображений/Cloudinary",
    scanCode(/optimizeImage|optimizeAlbumImage|canvas\.toBlob|image\/webp|quality|resource_type|use_filename|unique_filename|cacheControl|fetch_format|q_auto|f_auto|transformation/, 80)
  );
  printMatches(
    "Сохранение original/optimized и публичных id",
    scanCode(/secureUrl|publicId|imagePublicId|imageUrl|bytes: result\.bytes|previewUrl|optimizeAlbumImage|optimizedUploadMaxBytes/, 80)
  );

  console.log("\nВыводы");
  console.log(
    "- Новые portfolio images фотографов, аватарки/обложки профилей и видео альбомов должны идти в Cloudinary при наличии CLOUDINARY_* env."
  );
  console.log(
    "- Portfolio images оптимизируются всегда: клиентская WebP-версия до 1920px/quality 0.82 для альбомов и Cloudinary transformation c_limit 1920 + q_auto:good для серверных image uploads."
  );
  console.log(
    "- Старые supabase: media остаются совместимыми и продолжают показываться по сохраненной ссылке; автоматической миграции или удаления старых файлов нет."
  );
  console.log(
    "- В базе добавлены поля provider/url/publicId/bytes/originalBytes/width/height/format/mediaType для новых записей; у старых строк эти metadata могут быть пустыми."
  );
}

main()
  .catch((error) => {
    console.error("Usage audit failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
