-- DATA-4 — bring the four Wave-1 tables under the offline outbox.
--
-- sleep_logs, hydration_logs, supplement_intakes and readiness_logs were added
-- writing straight to Supabase, so a log taken in a basement gym or on a plane
-- was lost rather than queued. CLAUDE.md rule 3 requires client_id on every
-- offline-writable table; TECHNICAL-DESIGN §3 owns the list and is updated in
-- the same commit as this migration.
--
-- Nullable on purpose. Rows already written by the direct-insert code have no
-- client_id and a `not null` would fail the migration outright; new rows always
-- carry one. The unique index still does the real work — it is what makes
-- `upsert(..., { onConflict: 'client_id' })` idempotent when the sync worker
-- retries a request whose response was lost.
--
-- Note the difference between the two kinds of table here:
--   * hydration_logs / supplement_intakes are append-only events. A random
--     client_id per row is correct.
--   * sleep_logs / readiness_logs are one row per day, already unique on
--     (user_id, log_date). Their client_id MUST be derived from that pair
--     (lib/sync/stableId.ts), or editing the same day twice offline would
--     queue two different client_ids that both try to insert the same day and
--     the second one dies on the day-unique constraint forever.

alter table sleep_logs         add column client_id uuid;
alter table hydration_logs     add column client_id uuid;
alter table supplement_intakes add column client_id uuid;
alter table readiness_logs     add column client_id uuid;

-- Plain unique indexes, NOT partial. Postgres treats nulls as distinct in a
-- unique index, so the legacy null rows coexist happily — and a partial index
-- could not be used as an ON CONFLICT arbiter anyway (the arbiter predicate
-- would have to be restated in the statement, which PostgREST never does).
create unique index sleep_logs_client_id_key         on sleep_logs (client_id);
create unique index hydration_logs_client_id_key     on hydration_logs (client_id);
create unique index supplement_intakes_client_id_key on supplement_intakes (client_id);
create unique index readiness_logs_client_id_key     on readiness_logs (client_id);

-- Backfill the two one-row-per-day tables.
--
-- Without this, the first offline edit of a day that was already logged online
-- would arrive with a freshly derived client_id, match no existing row, and
-- then be rejected by the (user_id, log_date) unique constraint — permanently,
-- since the outbox would retry the same doomed payload forever. Deriving the
-- id for existing rows the same way the client does makes them upsert targets.
--
-- uuid_generate_v5 is SHA-1 based and fully specified, so lib/sync/stableId.ts
-- reproduces these exact values in the browser. The namespace is arbitrary but
-- must never change; it is duplicated in that file.
update sleep_logs
   set client_id = uuid_generate_v5('6f5b8c1e-3d2a-4f7b-9c48-5a1e2d3b4c5f', user_id::text || ':' || log_date::text)
 where client_id is null;

update readiness_logs
   set client_id = uuid_generate_v5('6f5b8c1e-3d2a-4f7b-9c48-5a1e2d3b4c5f', user_id::text || ':' || log_date::text)
 where client_id is null;
