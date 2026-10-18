import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

describe("Windows executable icon compatibility", () => {
  it("contains correctly declared 32-bit RGBA PNGs at every icon size", () => {
    const icon = readFileSync(
      new URL("../apps/desktop/build/icon.ico", import.meta.url)
    );
    expect(icon.readUInt16LE(0)).toBe(0);
    expect(icon.readUInt16LE(2)).toBe(1);
    const sizes = [];
    for (let i = 0; i < icon.readUInt16LE(4); i++) {
      const entry = 6 + i * 16;
      const width = icon[entry] || 256;
      const height = icon[entry + 1] || 256;
      expect(icon.readUInt16LE(entry + 4)).toBe(1);
      expect(icon.readUInt16LE(entry + 6)).toBe(32);
      const offset = icon.readUInt32LE(entry + 12);
      const png = icon.subarray(offset, offset + icon.readUInt32LE(entry + 8));
      expect([...png.subarray(0, 8)]).toEqual([
        137, 80, 78, 71, 13, 10, 26, 10
      ]);
      expect(png.toString("ascii", 12, 16)).toBe("IHDR");
      expect(png.readUInt32BE(16)).toBe(width);
      expect(png.readUInt32BE(20)).toBe(height);
      expect(png[24]).toBe(8);
      expect(png[25]).toBe(6); // RGB-only (2) is invalid for the declared 32-bit Windows icon.
      expect(png[28]).toBe(0);
      const data = [];
      for (let p = 8; p < png.length;) {
        const length = png.readUInt32BE(p);
        if (png.toString("ascii", p + 4, p + 8) === "IDAT")
          data.push(png.subarray(p + 8, p + 8 + length));
        p += length + 12;
      }
      expect(inflateSync(Buffer.concat(data))).toHaveLength(
        height * (1 + width * 4)
      );
      sizes.push(width);
    }
    expect(sizes).toEqual([16, 24, 32, 48, 64, 128, 256]);
  });
});
