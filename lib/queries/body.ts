import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { enqueueAndSync } from "@/lib/sync/syncWorker";
import type { Database } from "@/lib/database.types";

export type BodyMetric = Database["public"]["Tables"]["body_metrics"]["Row"];
export type ProgressPhoto = Database["public"]["Tables"]["progress_photos"]["Row"];

/** Most recent `limit` body_metrics rows, newest first. */
export function useBodyMetricsHistory(limit = 90) {
  return useQuery({
    queryKey: ["body-metrics", limit],
    queryFn: async (): Promise<BodyMetric[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("body_metrics")
        .select("*")
        .order("measured_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}

export interface LogBodyMetricInput {
  /** Local date (YYYY-MM-DD) the measurement was taken. Defaults to today. */
  measuredOn?: string;
  weightKg?: number | null;
  waistCm?: number | null;
  neckCm?: number | null;
  hipCm?: number | null;
  bodyFatPct?: number | null;
  bfMethod?: Database["public"]["Tables"]["body_metrics"]["Row"]["bf_method"];
}

/**
 * Midday local time for a backdated entry, so the row can't drift into the
 * neighbouring day when read back as a date in any timezone. Today's entries
 * keep the actual clock time.
 */
function measuredAtFor(measuredOn: string | undefined): string {
  if (!measuredOn) return new Date().toISOString();
  if (measuredOn === new Date().toLocaleDateString("en-CA")) return new Date().toISOString();
  return new Date(`${measuredOn}T12:00:00`).toISOString();
}

/** Logs a weigh-in / measurement snapshot — offline-writable via outbox (CLAUDE.md rule 3). */
export function useLogBodyMetric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LogBodyMetricInput) => {
      const supabase = createClient();
      const { data: userData, error } = await supabase.auth.getUser();
      if (error || !userData.user) throw new Error("Not signed in");

      const clientId = crypto.randomUUID();
      await enqueueAndSync("body_metrics", "upsert", {
        id: clientId,
        client_id: clientId,
        user_id: userData.user.id,
        measured_at: measuredAtFor(input.measuredOn),
        weight_kg: input.weightKg ?? null,
        waist_cm: input.waistCm ?? null,
        neck_cm: input.neckCm ?? null,
        hip_cm: input.hipCm ?? null,
        body_fat_pct: input.bodyFatPct ?? null,
        bf_method: input.bfMethod ?? null,
      });
      return clientId;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["body-metrics"] }),
  });
}

export type PhotoPose = Database["public"]["Enums"]["photo_pose"];

/** A stored photo plus a short-lived signed URL — the bucket is private. */
export interface ProgressPhotoWithUrl extends ProgressPhoto {
  url: string | null;
}

const SIGNED_URL_TTL_S = 60 * 60;

export function useProgressPhotos() {
  return useQuery({
    queryKey: ["progress-photos"],
    // Signed URLs expire, so don't serve them from cache past their life.
    staleTime: (SIGNED_URL_TTL_S / 2) * 1000,
    queryFn: async (): Promise<ProgressPhotoWithUrl[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("progress_photos")
        .select("*")
        .order("taken_at", { ascending: false });
      if (error) throw error;
      if (data.length === 0) return [];

      const { data: signed, error: signErr } = await supabase.storage
        .from("progress-photos")
        .createSignedUrls(
          data.map((p) => p.storage_path),
          SIGNED_URL_TTL_S
        );
      if (signErr) throw signErr;

      const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
      return data.map((p) => ({ ...p, url: urlByPath.get(p.storage_path) ?? null }));
    },
  });
}

/** Same-day photos, grouped into one comparable point in time. */
export interface PhotoSession {
  date: string;
  label: string;
  weightKgAtTime: number | null;
  urlByPose: Partial<Record<PhotoPose, string>>;
}

/** Newest-first in, newest-first out. */
export function groupPhotoSessions(photos: ProgressPhotoWithUrl[]): PhotoSession[] {
  const byDate = new Map<string, PhotoSession>();
  for (const photo of photos) {
    const date = photo.taken_at.slice(0, 10);
    let session = byDate.get(date);
    if (!session) {
      session = {
        date,
        label: new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        weightKgAtTime: photo.weight_kg_at_time,
        urlByPose: {},
      };
      byDate.set(date, session);
    }
    // First row wins per pose — they're already ordered newest-first.
    if (photo.url && !session.urlByPose[photo.pose]) session.urlByPose[photo.pose] = photo.url;
  }
  return [...byDate.values()];
}

export interface UploadPhotoInput {
  file: File;
  pose: PhotoPose;
  takenOn: string; // YYYY-MM-DD
  weightKgAtTime?: number | null;
}

/**
 * Uploads to the private `progress-photos` bucket then records the row. The
 * storage RLS policies key on the first path segment being the user's id, so
 * the `${userId}/` prefix is load-bearing, not cosmetic.
 */
export function useUploadProgressPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadPhotoInput): Promise<ProgressPhoto> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const ext = input.file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userData.user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("progress-photos")
        .upload(path, input.file, { contentType: input.file.type || "image/jpeg" });
      if (uploadErr) throw uploadErr;

      const { data, error } = await supabase
        .from("progress_photos")
        .insert({
          user_id: userData.user.id,
          storage_path: path,
          pose: input.pose,
          taken_at: new Date(`${input.takenOn}T12:00:00`).toISOString(),
          weight_kg_at_time: input.weightKgAtTime ?? null,
        })
        .select("*")
        .single();
      if (error) {
        // Don't leave an orphaned object behind if the row insert fails.
        await supabase.storage.from("progress-photos").remove([path]);
        throw error;
      }
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["progress-photos"] }),
  });
}
