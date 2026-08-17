"use client";

import { useRef, useState } from "react";
import type { PhotoPose, PhotoSession } from "@/lib/queries/body";

const POSES: PhotoPose[] = ["front", "side", "back", "other"];

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function weightLabel(kg: number | null): string {
  return kg === null ? "—" : `${Math.round(kg * 10) / 10} kg`;
}

export function PhotoCompare({ sessions }: { sessions: PhotoSession[] }) {
  // sessions is newest-first; "before" is always the oldest session on file,
  // "after" defaults to the newest and is switchable via the month pills.
  const before = sessions[sessions.length - 1];
  const [afterIndex, setAfterIndex] = useState(0);
  const [pose, setPose] = useState<PhotoPose>("front");
  const [pos, setPos] = useState(50);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const after = sessions[afterIndex];
  const beforeUrl = before.urlByPose[pose];
  const afterUrl = after.urlByPose[pose];
  // Only offer poses that actually exist somewhere in the set.
  const availablePoses = POSES.filter((p) => sessions.some((s) => s.urlByPose[p]));

  function setPosFromClientX(clientX: number) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setPos((p) => clamp(p - 5, 0, 100));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setPos((p) => clamp(p + 5, 0, 100));
    }
  }

  return (
    <div className="rounded-2xl bg-surface p-3.5 pb-4">
      <div
        ref={stageRef}
        role="slider"
        tabIndex={0}
        aria-label={`Compare progress photos, ${before.label} versus ${after.label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        className="relative aspect-[3/4] w-full touch-pan-y overflow-hidden rounded-xl bg-gradient-to-br from-surface-raised to-bg outline-none focus-visible:ring-2 focus-visible:ring-accent"
        style={{ cursor: "ew-resize" }}
        onPointerDown={(e) => {
          dragging.current = true;
          stageRef.current?.setPointerCapture(e.pointerId);
          setPosFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (dragging.current) setPosFromClientX(e.clientX);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
        onKeyDown={onKeyDown}
      >
        {/* before layer, full */}
        <div className="absolute inset-0 flex items-end bg-gradient-to-br from-surface-raised via-bg to-bg p-2.5">
          {beforeUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- signed Storage URLs expire; next/image would cache them past their TTL
            <img
              src={beforeUrl}
              alt={`${before.label}, ${pose} pose`}
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
              draggable={false}
            />
          )}
          <span className="relative rounded bg-black/55 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-fg">
            {before.label} · {pose}
            {!beforeUrl && " · no photo"}
          </span>
        </div>
        {/* after layer, clipped from the left up to `pos` */}
        <div
          className="absolute inset-0 flex items-end bg-gradient-to-br from-accent-dim/70 via-bg to-bg p-2.5"
          style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
        >
          {afterUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- see above
            <img
              src={afterUrl}
              alt={`${after.label}, ${pose} pose`}
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
              draggable={false}
            />
          )}
          <span className="relative rounded bg-black/55 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-fg">
            {after.label} · {pose}
            {!afterUrl && " · no photo"}
          </span>
        </div>
        {/* handle */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-0.5 -translate-x-1/2 bg-fg"
          style={{ left: `${pos}%` }}
        >
          <span className="absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-fg font-mono text-[11px] tracking-wide text-bg shadow-lg">
            ◂▸
          </span>
        </div>
      </div>

      <div className="mt-2.5 flex justify-between font-mono text-[10.5px] text-muted">
        <span>
          <strong className="text-fg">{before.label}</strong> · {weightLabel(before.weightKgAtTime)}
        </span>
        <span>
          <strong className="text-fg">{after.label}</strong> · {weightLabel(after.weightKgAtTime)}
        </span>
      </div>

      <div className="mt-3.5 flex gap-1.5 overflow-x-auto pb-0.5">
        {availablePoses.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPose(p)}
            aria-pressed={pose === p}
            className={`flex-none rounded-full border px-3 py-1.5 font-mono text-[10.5px] capitalize tracking-wide transition-colors ${
              pose === p
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-transparent bg-surface-raised text-muted hover:text-fg"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5">
        {sessions.map((s, i) => (
          <button
            key={s.date}
            type="button"
            onClick={() => setAfterIndex(i)}
            aria-pressed={afterIndex === i}
            className={`flex-none rounded-full border px-3 py-1.5 font-mono text-[10.5px] tracking-wide transition-colors ${
              afterIndex === i
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-transparent bg-surface-raised text-muted hover:text-fg"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
