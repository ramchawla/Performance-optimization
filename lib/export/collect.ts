/**
 * Full-account export — DATA-1.
 *
 * Every table is read with a plain unfiltered `select("*")`: RLS is the auth
 * layer (CLAUDE.md rule 4), so the database already returns exactly the rows
 * this user is allowed to see. Adding `.eq("user_id", …)` here would be
 * belt-and-braces on the tables that have that column and simply wrong on the
 * four child tables that don't (they're scoped through their parent).
 *
 * This module is deliberately pure data assembly with no formatting or UI, so
 * the AI insight layer can reuse it as its context source rather than growing
 * a second, divergent idea of "everything about this user".
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createZip } from "./zip";

/**
 * Order matters: parents precede children, so a restore can replay the export
 * top to bottom without tripping a foreign key.
 *
 * `integration_accounts` is deliberately absent — it holds live Strava OAuth
 * access and refresh tokens. An export is a file that gets emailed to itself,
 * dropped in cloud storage and forgotten about; long-lived credentials must
 * not ride along. They're re-obtainable by reconnecting in Settings.
 */
export const EXPORT_TABLES = [
  "profiles",
  "exercises",
  "foods",
  "recipes",
  "recipe_items",
  "workout_templates",
  "template_exercises",
  "workout_sessions",
  "session_exercises",
  "session_sets",
  "cardio_sessions",
  "nutrition_logs",
  "hydration_logs",
  "supplements",
  "supplement_intakes",
  "body_metrics",
  "progress_photos",
  "mobility_logs",
  "soreness_logs",
  "readiness_logs",
  "sleep_logs",
  "health_metrics",
] as const satisfies readonly (keyof Database["public"]["Tables"])[];

export type ExportTable = (typeof EXPORT_TABLES)[number];

export interface ExportBundle {
  /** Bumped when the shape changes, so a future importer can branch on it. */
  formatVersion: 1;
  exportedAt: string;
  userId: string;
  /** Table name → every row, as stored. Units are DB units (CLAUDE.md rule 1). */
  tables: Record<ExportTable, unknown[]>;
  /** Tables that failed to read. Empty on a good export — check it before trusting the file. */
  errors: { table: ExportTable; message: string }[];
  counts: Record<ExportTable, number>;
}

/**
 * Supabase caps a single response at 1000 rows regardless of what you ask for,
 * so paginate. Years of set-level training data will pass that on session_sets
 * long before anything else.
 */
const PAGE = 1000;

async function readAll(
  supabase: SupabaseClient<Database>,
  table: ExportTable
): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/**
 * Reads every exportable table. A table that fails is recorded in `errors`
 * rather than aborting the run — a partial export with a stated hole is more
 * useful than no export at all, and silently dropping a table would be the
 * one outcome that makes a backup dangerous.
 */
export async function collectExport(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ExportBundle> {
  const tables = {} as Record<ExportTable, unknown[]>;
  const counts = {} as Record<ExportTable, number>;
  const errors: ExportBundle["errors"] = [];

  type Result = { table: ExportTable; rows: unknown[] } | { table: ExportTable; message: string };

  const results: Result[] = await Promise.all(
    EXPORT_TABLES.map(async (table): Promise<Result> => {
      try {
        return { table, rows: await readAll(supabase, table) };
      } catch (e) {
        return { table, message: e instanceof Error ? e.message : String(e) };
      }
    })
  );

  for (const result of results) {
    if ("message" in result) {
      errors.push({ table: result.table, message: result.message });
      tables[result.table] = [];
      counts[result.table] = 0;
    } else {
      tables[result.table] = result.rows;
      counts[result.table] = result.rows.length;
    }
  }

  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    userId,
    tables,
    errors,
    counts,
  };
}

export interface PhotoArchive {
  zip: Uint8Array<ArrayBuffer>;
  filename: string;
  photoCount: number;
  /** Photos whose bytes couldn't be fetched, by storage path. */
  errors: { path: string; message: string }[];
}

/**
 * Progress photos live in Storage, not in a table, so the JSON export can't
 * carry them — and on the free plan Supabase never backs Storage up. Without
 * this they are the one category of data with no copy anywhere.
 *
 * Signed URLs rather than public ones because the bucket is private; they're
 * used immediately and never persisted.
 */
export async function collectPhotos(
  supabase: SupabaseClient<Database>,
  onProgress?: (done: number, total: number) => void
): Promise<PhotoArchive> {
  const { data: rows, error } = await supabase
    .from("progress_photos")
    .select("*")
    .order("taken_at", { ascending: true });
  if (error) throw new Error(error.message);

  const photos = rows ?? [];
  const errors: PhotoArchive["errors"] = [];
  const files: { name: string; data: Uint8Array }[] = [];

  if (photos.length) {
    const { data: signed, error: signErr } = await supabase.storage
      .from("progress-photos")
      .createSignedUrls(
        photos.map((p) => p.storage_path),
        // Long enough to download a few dozen photos on hotel wifi, short
        // enough that a URL leaking out of a log is nearly worthless.
        600
      );
    if (signErr) throw new Error(signErr.message);

    const urlByPath = new Map(signed?.map((s) => [s.path, s.signedUrl]) ?? []);

    // Sequential, not Promise.all: this runs on a phone, and firing fifty
    // full-size image downloads at once is how you get memory pressure and
    // truncated responses. Backups should be boring.
    let done = 0;
    for (const photo of photos) {
      const url = urlByPath.get(photo.storage_path);
      try {
        if (!url) throw new Error("no signed URL returned");
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        // Name by date and pose so the archive is browsable without the
        // manifest, and keep the original extension.
        const ext = photo.storage_path.split(".").pop() ?? "jpg";
        files.push({
          name: `photos/${photo.taken_at.slice(0, 10)}-${photo.pose}-${photo.id.slice(0, 8)}.${ext}`,
          data: new Uint8Array(await response.arrayBuffer()),
        });
      } catch (e) {
        errors.push({
          path: photo.storage_path,
          message: e instanceof Error ? e.message : String(e),
        });
      }
      onProgress?.(++done, photos.length);
    }
  }

  // The rows travel with the bytes: pose, date and weight-at-the-time are what
  // make a photo mean anything, and they'd be lost in a folder of JPEGs.
  files.push({
    name: "photos.json",
    data: new TextEncoder().encode(JSON.stringify({ photos, errors }, null, 2)),
  });

  return {
    zip: createZip(files),
    filename: `performance-hub-photos-${new Date().toISOString().slice(0, 10)}.zip`,
    photoCount: files.length - 1,
    errors,
  };
}

export function totalRows(bundle: ExportBundle): number {
  return Object.values(bundle.counts).reduce((sum, n) => sum + n, 0);
}

/** `performance-hub-2026-08-22.json` — sorts chronologically in a folder. */
export function exportFilename(bundle: ExportBundle): string {
  return `performance-hub-${bundle.exportedAt.slice(0, 10)}.json`;
}
