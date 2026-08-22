"use client";

import { useRef, useState } from "react";
import { useUploadProgressPhoto, type PhotoPose } from "@/lib/queries/body";
import { todayLocal } from "@/lib/datetime";

const POSES: PhotoPose[] = ["front", "side", "back", "other"];

export function PhotoUpload({
  latestWeightKg,
  onDone,
}: {
  latestWeightKg: number | null;
  onDone: () => void;
}) {
  const upload = useUploadProgressPhoto();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pose, setPose] = useState<PhotoPose>("front");
  const [takenOn, setTakenOn] = useState(todayLocal);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    upload.mutate(
      { file, pose, takenOn, weightKgAtTime: latestWeightKg },
      {
        onSuccess: () => {
          setFile(null);
          if (fileRef.current) fileRef.current.value = "";
          onDone();
        },
      }
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="animate-enter space-y-3 rounded-2xl border border-surface-raised bg-surface p-3.5"
    >
      <p className="font-display text-xs font-bold uppercase tracking-wide text-muted">Add progress photo</p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Choose a progress photo"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="w-full text-xs text-muted file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-surface-raised file:px-3 file:py-2 file:font-display file:text-xs file:font-bold file:text-fg"
      />

      <div className="flex flex-wrap gap-1.5">
        {POSES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPose(p)}
            aria-pressed={pose === p}
            className={`rounded-full border px-3 py-1.5 text-xs capitalize transition-colors duration-150 ${
              pose === p ? "border-accent/40 bg-accent/10 text-accent" : "border-surface-raised text-muted hover:text-fg"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-xs text-muted">
        Taken on
        <input
          type="date"
          value={takenOn}
          max={todayLocal()}
          onChange={(e) => setTakenOn(e.target.value)}
          className="rounded-xl border border-surface-raised bg-bg px-3 py-2 font-mono text-sm text-fg focus-visible:border-accent focus-visible:outline-none"
        />
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!file || upload.isPending}
          className="min-h-11 flex-1 rounded-xl bg-accent px-3 py-2 font-display text-sm font-bold text-bg transition-transform duration-200 active:scale-[0.98] disabled:opacity-50"
        >
          {upload.isPending ? "Uploading…" : "Upload"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-11 rounded-xl border border-surface-raised px-3 py-2 text-sm text-fg transition-colors duration-200 hover:bg-surface-raised active:scale-[0.98]"
        >
          Cancel
        </button>
      </div>

      {upload.isError && (
        <p className="text-xs text-red-400">
          {upload.error instanceof Error ? upload.error.message : "Upload failed — try again."}
        </p>
      )}
    </form>
  );
}
