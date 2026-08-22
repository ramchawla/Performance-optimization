import { describe, expect, it } from "vitest";
import { createZip, crc32 } from "./zip";

const bytes = (s: string) => new TextEncoder().encode(s);
const readU32 = (z: Uint8Array, at: number) =>
  (z[at] | (z[at + 1] << 8) | (z[at + 2] << 16) | (z[at + 3] << 24)) >>> 0;
const readU16 = (z: Uint8Array, at: number) => z[at] | (z[at + 1] << 8);

describe("crc32", () => {
  it("matches the standard check vector", () => {
    // "123456789" -> 0xCBF43926 is the published CRC-32/ISO-HDLC check value.
    // If this is wrong every archive is silently corrupt to a real unzipper.
    expect(crc32(bytes("123456789"))).toBe(0xcbf43926);
  });

  it("is zero for empty input", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe("createZip", () => {
  it("writes the signatures and counts a reader looks for", () => {
    const zip = createZip([
      { name: "a.txt", data: bytes("hello") },
      { name: "b/c.txt", data: bytes("world!") },
    ]);

    expect(readU32(zip, 0)).toBe(0x04034b50); // first local header

    // End-of-central-directory is the last 22 bytes when there's no comment,
    // and is where an unzipper starts reading.
    const eocd = zip.length - 22;
    expect(readU32(zip, eocd)).toBe(0x06054b50);
    expect(readU16(zip, eocd + 8)).toBe(2); // entries on this disk
    expect(readU16(zip, eocd + 10)).toBe(2); // entries total

    const cdSize = readU32(zip, eocd + 12);
    const cdOffset = readU32(zip, eocd + 16);
    expect(cdOffset + cdSize).toBe(eocd); // central directory abuts the EOCD
    expect(readU32(zip, cdOffset)).toBe(0x02014b50); // first central header
  });

  it("stores content verbatim with its crc", () => {
    const data = bytes("hello");
    const zip = createZip([{ name: "a.txt", data }]);

    expect(readU32(zip, 14)).toBe(crc32(data)); // crc field
    expect(readU32(zip, 18)).toBe(data.length); // compressed size
    expect(readU32(zip, 22)).toBe(data.length); // uncompressed size
    expect(readU16(zip, 8)).toBe(0); // method: stored, not deflated

    // Body sits immediately after the 30-byte header plus the filename.
    const start = 30 + "a.txt".length;
    expect(zip.slice(start, start + data.length)).toEqual(data);
  });

  it("handles a payload far past the argument-spread limit", () => {
    // The first version of this built the archive with push(...data), which
    // stack-overflows somewhere around 100k arguments. A single progress photo
    // is bigger than that, so it would have failed on the very first real use.
    const big = new Uint8Array(500_000).fill(7);
    const zip = createZip([{ name: "big.bin", data: big }]);
    expect(readU32(zip, zip.length - 22)).toBe(0x06054b50);
    expect(zip.length).toBeGreaterThan(500_000);
  });

  it("produces an empty but valid archive for no entries", () => {
    const zip = createZip([]);
    expect(zip.length).toBe(22);
    expect(readU32(zip, 0)).toBe(0x06054b50);
    expect(readU16(zip, 8)).toBe(0);
  });
});
