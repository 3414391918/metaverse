import { describe, expect, it } from "vitest";
import {
  DEFAULT_MATERIAL_LIBRARY_AGENT_SYSTEM_PROMPT,
  DEFAULT_SKILL_LIBRARY_AGENT_SYSTEM_PROMPT
} from "./library-agent-defaults";

describe("virtual world builtin prompts", () => {
  it("uses the unified brand and creative workspace names", () => {
    for (const prompt of [
      DEFAULT_MATERIAL_LIBRARY_AGENT_SYSTEM_PROMPT,
      DEFAULT_SKILL_LIBRARY_AGENT_SYSTEM_PROMPT
    ]) {
      expect(prompt).toContain("虚拟世界");
      expect(prompt).not.toMatch(/deepwrite|long-form|短篇|剧本|长篇/i);
    }
  });
});
