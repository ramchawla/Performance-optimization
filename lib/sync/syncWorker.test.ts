import { describe, it, expect } from "vitest";
import { nextBackoffMs } from "./syncWorker";

// ponytail: drainOutbox/startSyncWorker touch real IndexedDB (see outbox.ts)
// and aren't covered here to avoid adding a fake-indexeddb dependency just
// for tests. Add an integration test with fake-indexeddb if this logic
// grows past the backoff/parking rule.
describe("nextBackoffMs", () => {
  it("returns the 2s/8s/30s backoff schedule by attempt count", () => {
    expect(nextBackoffMs(0)).toBe(2_000);
    expect(nextBackoffMs(1)).toBe(8_000);
    expect(nextBackoffMs(2)).toBe(30_000);
  });

  it("returns null once attempts exceed the schedule (parked)", () => {
    expect(nextBackoffMs(3)).toBeNull();
    expect(nextBackoffMs(10)).toBeNull();
  });
});
