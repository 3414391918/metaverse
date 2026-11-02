import { describe, expect, it } from "vitest";
import { sessionPanelPatch } from "../integrations/harness/plugin/navigation.js";

describe("assistant settings navigation", () => {
  it.each(["models", "plugins", "presets"])(
    "keeps %s open when background session initialization selects a panel",
    (screen) => {
      expect(sessionPanelPatch(screen, null)).toEqual({
        activePanelId: null,
        screen
      });
      expect(sessionPanelPatch(screen, "conversation").screen).toBe(screen);
    }
  );

  it("continues to select conversation panels in the assistant", () => {
    expect(sessionPanelPatch("assistant", null)).toEqual({
      activePanelId: null,
      screen: "assistant"
    });
    expect(sessionPanelPatch("assistant", "plugins").screen).toBe("plugins");
  });
});
