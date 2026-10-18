import { describe, expect, it } from "vitest";
import { fishAudioPageUrl } from "./fishAudioPageUrl";

describe("fishAudioPageUrl", () => {
  it("opens a voice's Fish Audio page", () => {
    const url = new URL(
      fishAudioPageUrl({
        kind: "voice",
        id: "8fa6ecf2d58d4be892366c0886b9527f"
      })
    );
    expect(url.protocol).toBe("https:");
    expect(url.pathname).toBe("/zh-CN/app/m/8fa6ecf2d58d4be892366c0886b9527f/");
  });

  it("keeps platform IDs inside a single URL path segment", () => {
    expect(
      new URL(fishAudioPageUrl({ kind: "voice", id: "abc/def" })).pathname
    ).toBe("/zh-CN/app/m/abc%2Fdef/");
  });
});
