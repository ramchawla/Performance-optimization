/**
 * Minimal store-only ZIP writer.
 *
 * Photos are JPEGs — already compressed — so deflating them buys nothing and
 * costs a dependency. Storing them uncompressed inside a zip container is a
 * couple of fixed-layout headers and a CRC, which is why this is ~90 lines
 * instead of a package (CLAUDE.md rule 9).
 *
 * Format: PKZIP APPNOTE 6.3.3, method 0 (stored), no zip64, no encryption.
 * That ceiling is fine for progress photos and stated below where it bites.
 */

// ponytail: no zip64. Breaks past 4GB total or 65535 files. A decade of
// progress photos is a few hundred MB; revisit if that stops being true.
const MAX_ENTRIES = 0xffff;

/** Standard CRC-32 (IEEE 802.3), the polynomial ZIP requires. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  /** Path inside the archive. Forward slashes only, no leading slash. */
  name: string;
  data: Uint8Array;
}

/**
 * DOS timestamps have 2-second resolution and no timezone. Every entry gets
 * the same fixed stamp rather than a real clock reading: the archive is then
 * byte-identical for identical input, which makes it diffable and testable,
 * and the true date lives on the JSON bundle anyway.
 */
const DOS_TIME = 0;
const DOS_DATE = 0x21; // 1980-01-01, the epoch of the format

/**
 * Chunk list rather than a plain number[]. Pushing file bytes one at a time —
 * or worse, spreading a Uint8Array into push() — is what turns a multi-megabyte
 * photo into a stack overflow. Headers are small enough to build as arrays;
 * file bodies are appended by reference and only copied once, at the end.
 */
class ByteSink {
  private chunks: Uint8Array[] = [];
  length = 0;

  push(chunk: Uint8Array) {
    this.chunks.push(chunk);
    this.length += chunk.length;
  }

  concat(): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }

  all(): Uint8Array[] {
    return this.chunks;
  }
}

function u16(v: number): number[] {
  return [v & 0xff, (v >>> 8) & 0xff];
}

function u32(v: number): number[] {
  return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
}

export function createZip(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
  if (entries.length > MAX_ENTRIES) {
    throw new Error(`Too many files for a non-zip64 archive (${entries.length} > ${MAX_ENTRIES})`);
  }

  const encoder = new TextEncoder();
  const local = new ByteSink();
  const central = new ByteSink();

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const size = entry.data.length;
    const crc = crc32(entry.data);
    const offset = local.length;

    if (offset + size > 0xffffffff) {
      throw new Error("Archive exceeds 4GB; zip64 would be required");
    }

    local.push(
      Uint8Array.from([
        ...u32(0x04034b50), // local file header signature
        ...u16(20), // version needed: 2.0
        ...u16(0x0800), // flags: filename is UTF-8
        ...u16(0), // method: stored
        ...u16(DOS_TIME),
        ...u16(DOS_DATE),
        ...u32(crc),
        ...u32(size), // compressed size == uncompressed when stored
        ...u32(size),
        ...u16(name.length),
        ...u16(0), // extra field length
      ])
    );
    local.push(name);
    local.push(entry.data);

    central.push(
      Uint8Array.from([
        ...u32(0x02014b50), // central directory header signature
        ...u16(20), // version made by
        ...u16(20), // version needed
        ...u16(0x0800),
        ...u16(0),
        ...u16(DOS_TIME),
        ...u16(DOS_DATE),
        ...u32(crc),
        ...u32(size),
        ...u32(size),
        ...u16(name.length),
        ...u16(0), // extra
        ...u16(0), // comment
        ...u16(0), // disk number
        ...u16(0), // internal attrs
        ...u32(0), // external attrs
        ...u32(offset), // where the local header lives
      ])
    );
    central.push(name);
  }

  const end = Uint8Array.from([
    ...u32(0x06054b50), // end of central directory signature
    ...u16(0), // this disk
    ...u16(0), // disk holding the central directory
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(central.length),
    ...u32(local.length), // central directory starts where local data ends
    ...u16(0), // archive comment length
  ]);

  const out = new ByteSink();
  for (const chunk of local.all()) out.push(chunk);
  for (const chunk of central.all()) out.push(chunk);
  out.push(end);
  return out.concat();
}
