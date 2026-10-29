import { describe, expect, it } from "vitest";
import { migrateLegacyDefaultModel } from "./assistant-model-migration";

describe("Qwen default model migration", () => {
  it("replaces a saved DeepSeek selection without changing unrelated settings", () => {
    const previous = `- id: another-setting
  config:
    enabled: true
- id: agent-default-model
  name: "@deepseek-ai/dsh-agent-default-model"
  config:
    provider: deepseek-official
    model: deepseek-v4-pro
    reasoningEffort: high
- id: another-plugin
  disabled: true
`;
    const next = migrateLegacyDefaultModel(previous);
    expect(next).toContain("provider: venice");
    expect(next).toContain("model: qwen-3-6-plus");
    expect(next).not.toContain("reasoningEffort: high");
    expect(next).toContain("enabled: true");
    expect(next).toContain("- id: another-plugin\n  disabled: true");
    expect(migrateLegacyDefaultModel(next)).toBe(next);
  });

  it("replaces the previous Venice default without changing another Venice model", () => {
    const previous = `- id: agent-default-model\n  config:\n    provider: venice\n    model: venice-uncensored-1-2\n`;
    expect(migrateLegacyDefaultModel(previous)).toContain(
      "model: qwen-3-6-plus"
    );
    const gemma = previous.replace(
      "venice-uncensored-1-2",
      "gemma-4-uncensored"
    );
    expect(migrateLegacyDefaultModel(gemma)).toContain("model: qwen-3-6-plus");
    const custom = previous.replace("venice-uncensored-1-2", "kimi-k3");
    expect(migrateLegacyDefaultModel(custom)).toBe(custom);
  });

  it("preserves a selection already using another provider", () => {
    const custom = `- id: agent-default-model
  config:
    provider: custom
    model: my-model
`;
    expect(migrateLegacyDefaultModel(custom)).toBe(custom);
  });
});
