import type { ReactNode } from "react";

interface VitalCardProps {
  icon: ReactNode;
  value: string;
  label: string;
  trendLabel: string;
  favorable: boolean;
}

/** Small icon + value + trend card for the vitals row (RHR / sleep / calories burned). */
export function VitalCard({ icon, value, label, trendLabel, favorable }: VitalCardProps) {
  return (
    <div className="animate-enter rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center backdrop-blur-xl transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.97]">
      <div className={`mx-auto mb-2 h-5 w-5 ${favorable ? "text-accent" : "text-muted"}`}>{icon}</div>
      <p className="font-display text-lg font-bold tabular-nums text-fg">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-[11px] ${favorable ? "text-accent" : "text-muted"}`}>{trendLabel}</p>
    </div>
  );
}
