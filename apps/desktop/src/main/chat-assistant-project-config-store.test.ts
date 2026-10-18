import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CHAT_ASSISTANT_PROJECT_PROMPT_MAX_LENGTH,
  DEFAULT_CHAT_ASSISTANT_PROJECT_PROMPT
} from "@deepwrite/contracts";
import { describe, expect, it } from "vitest";
import { ChatAssistantProjectConfigStore } from "./chat-assistant-project-config-store";

async function createStore() {
  const root = await mkdtemp(join(tmpdir(), "deepwrite-chat-config-"));
  return { root, store: new ChatAssistantProjectConfigStore(root) };
}

describe("ChatAssistantProjectConfigStore", () => {
  it("keeps prompts isolated by project type and id and resets independently", async () => {
    const { store } = await createStore();
    const short = { projectType: "short" as const, projectId: "book-a" };
    const long = { projectType: "long" as const, projectId: "book-a" };

    expect(await store.get(short)).toMatchObject({
      systemPrompt: DEFAULT_CHAT_ASSISTANT_PROJECT_PROMPT,
      customized: false
    });
    await store.save(short, "只关注人物弧光。 ");
    await store.save(long, "优先核对连续性。 ");
    expect(await store.list()).toEqual([short, long]);
    expect((await store.get(short)).systemPrompt).toBe("只关注人物弧光。");
    expect((await store.get(long)).systemPrompt).toBe("优先核对连续性。");

    expect(await store.reset(short)).toMatchObject({
      systemPrompt: DEFAULT_CHAT_ASSISTANT_PROJECT_PROMPT,
      customized: false
    });
    expect((await store.get(long)).customized).toBe(true);
    expect(await store.list()).toEqual([short, long]);
  });

  it("falls back from damaged files and writes versioned JSON atomically", async () => {
    const { root, store } = await createStore();
    const configDirectory = join(root, "config");
    const configPath = join(configDirectory, "chat-assistant-projects.json");
    await mkdir(configDirectory, { recursive: true });
    await writeFile(configPath, "{ damaged", "utf8");
    const project = { projectType: "script" as const, projectId: "script-1" };

    expect((await store.get(project)).customized).toBe(false);
    await store.save(project, "只读剧本顾问。 ");
    expect(JSON.parse(await readFile(configPath, "utf8"))).toEqual({
      version: 1,
      projects: ["script:script-1"],
      prompts: { "script:script-1": "只读剧本顾问。" }
    });
  });

  it("migrates configured projects from legacy prompt keys", async () => {
    const { root, store } = await createStore();
    const configDirectory = join(root, "config");
    const configPath = join(configDirectory, "chat-assistant-projects.json");
    await mkdir(configDirectory, { recursive: true });
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        prompts: { "short:legacy-book": "沿用已有配置。" }
      }),
      "utf8"
    );

    expect(await store.list()).toEqual([
      { projectType: "short", projectId: "legacy-book" }
    ]);
  });

  it("rejects empty and overlong prompts", async () => {
    const { store } = await createStore();
    const project = { projectType: "short" as const, projectId: "book-limits" };
    await expect(store.save(project, "  ")).rejects.toThrow();
    await expect(
      store.save(
        project,
        "x".repeat(CHAT_ASSISTANT_PROJECT_PROMPT_MAX_LENGTH + 1)
      )
    ).rejects.toThrow();
  });
});
