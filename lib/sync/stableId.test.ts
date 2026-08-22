import { describe, expect, it } from "vitest";
import { dailyClientId, uuidV5 } from "./stableId";

const DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const URL_NAMESPACE = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

describe("uuidV5", () => {
  /**
   * The whole point of these vectors: migration 0006 backfills client_ids with
   * Postgres's uuid_generate_v5, and this function has to produce byte-identical
   * output or the backfilled rows become unreachable to the client. Both
   * implement RFC 4122, so agreeing with the published vectors means agreeing
   * with each other.
   */
  it("matches the published RFC 4122 vectors", async () => {
    expect(await uuidV5("www.example.com", DNS_NAMESPACE)).toBe(
      "2ed6657d-e927-568b-95e1-2665a8aea6a2"
    );
    expect(await uuidV5("http://www.example.com/", URL_NAMESPACE)).toBe(
      "fcde3c85-2270-590f-9e7c-ee003d65e0e2"
    );
  });

  it("agrees with Postgres uuid_generate_v5 on the real namespace", async () => {
    // Captured from the live database, which is what migration 0006's backfill
    // runs. If this ever fails, backfilled rows have become unreachable to the
    // client and the outbox will insert duplicates instead of updating.
    expect(await uuidV5("11111111-2222-3333-4444-555555555555:2026-08-22")).toBe(
      "64b6e67c-7dfd-5851-bbc1-340393211740"
    );
  });

  it("sets the version and variant bits", async () => {
    const id = await uuidV5("anything");
    expect(id[14]).toBe("5");
    expect("89ab").toContain(id[19]);
  });
});

describe("dailyClientId", () => {
  const user = "11111111-2222-3333-4444-555555555555";

  it("is stable for the same user and day", async () => {
    // The property the outbox depends on: editing a day twice offline must
    // queue the same client_id, or the second write dies on (user_id, log_date).
    expect(await dailyClientId(user, "2026-08-22")).toBe(await dailyClientId(user, "2026-08-22"));
  });

  it("differs across days and across users", async () => {
    const a = await dailyClientId(user, "2026-08-22");
    expect(await dailyClientId(user, "2026-08-23")).not.toBe(a);
    expect(await dailyClientId("99999999-2222-3333-4444-555555555555", "2026-08-22")).not.toBe(a);
  });
});
