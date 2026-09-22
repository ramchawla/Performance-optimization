-- Adds Garmin as a third integration provider, alongside Strava and Apple
-- Health (health_export). See TECHNICAL-DESIGN.md §7b.
--
-- ALTER TYPE ... ADD VALUE cannot be used in the same transaction as any
-- query that references the new label (Postgres restriction, still true on
-- PG17) — so this migration ONLY adds the enum value and the provider check.
-- The daily_rollup view, which references 'garmin' as a literal, is updated
-- in the next migration instead.

alter type metric_source add value if not exists 'garmin';

alter table integration_accounts drop constraint integration_accounts_provider_check;
alter table integration_accounts add constraint integration_accounts_provider_check
  check (provider in ('strava', 'health_export', 'garmin'));
