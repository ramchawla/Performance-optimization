-- Sleep section (docs/superpowers/specs/2026-09-24-sleep-section-design.md):
-- with Garmin supplying every measurement, sleep_logs becomes the subjective
-- layer — how the night felt, notes, and behaviour tags (caffeine_late,
-- alcohol, late_meal, ...) that later insights can correlate against.
-- The Apple sleep-score columns stay (no data loss); the UI just stops using them.
alter table sleep_logs add column tags text[] not null default '{}';
