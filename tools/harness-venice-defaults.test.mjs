import { describe, expect, it } from "vitest";
import { configureVeniceDefaults } from "./harness-venice-defaults.mjs";

const upstream = `- insert:
    - id: agent-default-model
      name: '@deepseek-ai/dsh-agent-default-model'
      config:
        provider: deepseek-official
        model: deepseek-flash
    - id: llm-pi-ai
      name: '@deepseek-ai/dsh-llm-pi-ai'

    - id: session-persistence-jsonl
      name: '@deepseek-ai/dsh-session-persistence-jsonl'
    - id: unrelated
      name: 'example'
`;

describe("Venice Harness defaults", () => {
  it("uses Venice's OpenAI-compatible route and selected model", () => {
    const configured = configureVeniceDefaults(upstream);
    expect(configured).toContain("provider: venice");
    expect(configured).toContain("model: qwen-3-6-plus");
    expect(configured).toContain("api: openai-completions");
    expect(configured).toContain("baseURL: https://api.venice.ai/api/v1");
    expect(configured).toContain("apiKeyEnv: VENICE_API_KEY");
    expect(configured).toContain("- id: qwen-3-6-plus");
    expect(configured).toContain("reasoningEfforts: false");
    expect(configured).toContain("- id: unrelated");
    expect(configureVeniceDefaults(configured)).toBe(configured);
  });

  it("fails if the pinned Harness layout changes", () => {
    expect(() => configureVeniceDefaults("- insert: []\n")).toThrow(
      "Pinned Harness model defaults changed"
    );
  });

  it("updates a previously staged Venice provider catalog", () => {
    const configured = configureVeniceDefaults(upstream);
    const old = configured
      .replace("model: qwen-3-6-plus", "model: venice-uncensored-1-2")
      .replace(
        /              - id: gemma-4-uncensored[\s\S]*?(?=\n\n    - id: session-persistence-jsonl)/u,
        ""
      );
    const updated = configureVeniceDefaults(old);
    expect(updated).toContain("model: qwen-3-6-plus");
    expect(updated).toContain("- id: qwen-3-6-plus");
    expect(configureVeniceDefaults(updated)).toBe(updated);
  });
});
