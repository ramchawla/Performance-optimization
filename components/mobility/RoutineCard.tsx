"use client";

import { useEffect, useRef, useState } from "react";
import type { MobilityRoutine } from "@/lib/mock/mobilityMock";

interface Particle {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

interface RoutineCardProps {
  routine: MobilityRoutine;
  onComplete: (routineName: string, durationSec: number) => void;
}

const MINI_RING_CIRCUMFERENCE = 126; // 2 * PI * r(20), matches mini-ring geometry below

/** Routine card: Start spawns a particle burst and morphs into a live mm:ss
 * timer with a pulsing mini ring; Stop logs the session and shows a brief
 * "Logged" confirmation before returning to the idle face. */
export function RoutineCard({ routine, onComplete }: RoutineCardProps) {
  const [status, setStatus] = useState<"idle" | "active" | "done">("idle");
  const [seconds, setSeconds] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  const startBtnRef = useRef<HTMLButtonElement>(null);
  const particleId = useRef(0);

  useEffect(() => {
    if (status !== "active") return;
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  function spawnParticles() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    const btn = startBtnRef.current;
    const card = cardRef.current;
    if (!btn || !card) return;
    const btnRect = btn.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const originX = btnRect.left - cardRect.left + btnRect.width / 2;
    const originY = btnRect.top - cardRect.top + btnRect.height / 2;

    const next: Particle[] = [];
    for (let i = 0; i < 7; i++) {
      const angle = (Math.PI * 2 * i) / 7 + Math.random() * 0.4;
      const dist = 30 + Math.random() * 20;
      particleId.current += 1;
      next.push({ id: particleId.current, x: originX, y: originY, dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist });
    }
    setParticles((p) => [...p, ...next]);
    setTimeout(() => {
      setParticles((p) => p.filter((particle) => !next.some((n) => n.id === particle.id)));
    }, 650);
  }

  function handleStart() {
    spawnParticles();
    setSeconds(0);
    setStatus("active");
  }

  function handleStop() {
    setStatus("done");
    onComplete(routine.name, seconds);
    setTimeout(() => setStatus("idle"), 1600);
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div ref={cardRef} className="relative overflow-hidden rounded-2xl border border-surface-raised bg-surface p-4">
      {/* Idle face */}
      <div className={`flex items-center justify-between gap-3 transition-opacity duration-200 ${status === "idle" ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold text-fg">{routine.name}</p>
          <p className="text-[11.5px] text-muted">
            {routine.durationMin} min · {routine.stretchCount} stretches · {routine.targetArea}
          </p>
        </div>
        <button
          ref={startBtnRef}
          type="button"
          onClick={handleStart}
          className="shrink-0 rounded-full bg-accent px-4 py-2.5 text-xs font-semibold text-bg transition-transform duration-150 active:scale-90"
        >
          Start
        </button>
      </div>

      {/* Active face: live timer + pulsing mini ring */}
      {status === "active" && (
        <div className="absolute inset-0 flex items-center gap-3.5 bg-surface p-4">
          <svg viewBox="0 0 46 46" className="h-[46px] w-[46px] shrink-0 -rotate-90">
            <circle cx="23" cy="23" r="20" fill="none" stroke="var(--surface-raised)" strokeWidth="5" />
            <circle
              cx="23"
              cy="23"
              r="20"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={MINI_RING_CIRCUMFERENCE}
              strokeDashoffset={MINI_RING_CIRCUMFERENCE}
              className="animate-mobility-pulse-ring"
            />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[13.5px] font-bold text-fg">{routine.name}</p>
            <p className="font-mono text-xs tabular-nums text-accent">
              {mm}:{ss}
            </p>
          </div>
          <button
            type="button"
            onClick={handleStop}
            className="shrink-0 rounded-full border border-surface-raised px-3.5 py-2 text-xs font-semibold text-fg transition-transform duration-100 active:scale-95"
          >
            Stop
          </button>
        </div>
      )}

      {/* Done confirmation */}
      {status === "done" && (
        <div className="absolute inset-0 flex items-center justify-center gap-2.5 bg-surface animate-enter">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-accent text-bg">✓</span>
          <span className="font-display text-sm font-bold text-fg">Logged</span>
        </div>
      )}

      {particles.map((p) => (
        <span
          key={p.id}
          className="animate-mobility-burst pointer-events-none absolute h-[5px] w-[5px] rounded-full bg-accent"
          style={{
            left: p.x,
            top: p.y,
            // @ts-expect-error -- CSS custom properties aren't in CSSProperties
            "--dx": `${p.dx}px`,
            "--dy": `${p.dy}px`,
          }}
        />
      ))}
    </div>
  );
}
