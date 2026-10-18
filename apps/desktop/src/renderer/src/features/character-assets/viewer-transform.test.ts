import { describe, expect, it } from "vitest";
import { zoomTransform, panTransform } from "../../utils/imageViewerTransform";

describe("image viewer transforms", () => {
  it("keeps the image point under the cursor while zooming", () => {
    expect(zoomTransform({ scale: 1, x: 0, y: 0 }, 2, 100, 50)).toEqual({
      scale: 2,
      x: -100,
      y: -50
    });
  });
  it("bounds zoom and prevents panning the whole image out of view", () => {
    expect(zoomTransform({ scale: 1, x: 0, y: 0 }, 100, 0, 0).scale).toBe(8);
    expect(
      panTransform({ scale: 1, x: 0, y: 0 }, 10000, -10000, 400, 300)
    ).toEqual({ scale: 1, x: 200, y: -150 });
  });
});
