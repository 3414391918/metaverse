import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { LongAgentConfigStore } from "./long-agent-config-store";
import type { LibraryAgentConfigStore } from "./library-agent-config-store";

export interface ToolGuidanceFile {
  toolId: string;
  path: string;
  content: string;
}

export async function savedToolGuidance(
  longAgents: LongAgentConfigStore,
  libraryAgents: LibraryAgentConfigStore,
  userDataPath: string
): Promise<ToolGuidanceFile[]> {
  const files: ToolGuidanceFile[] = [];
  const longSettings = await longAgents.list();
  const main = longSettings.agents.find((agent) => agent.id === "long");
  if (main?.systemPrompt.trim()) {
    files.push({
      toolId: "creation",
      path: "writing-rules.md",
      content: main.systemPrompt
    });
  }
  const librarySettings = await libraryAgents.list();
  for (const agent of librarySettings.agents) {
    if (!agent.systemPrompt.trim()) continue;
    const skills = agent.readAccess.skills
      .map((skill) => `## ${skill.name}\n\n${skill.content}`)
      .join("\n\n");
    files.push({
      toolId: "creation",
      path: `${agent.domain}-management.md`,
      content: skills
        ? `${agent.systemPrompt}\n\n${skills}\n`
        : agent.systemPrompt
    });
  }
  try {
    const registry = JSON.parse(
      await readFile(join(userDataPath, "catalog-registry.json"), "utf8")
    ) as { projects?: Array<{ domain?: string; projectDirectory?: string }> };
    const directories = (registry.projects ?? [])
      .filter(
        ({ domain, projectDirectory }) =>
          (domain === "skill" || domain === "material") &&
          typeof projectDirectory === "string"
      )
      .map(({ projectDirectory }) => projectDirectory!);
    if (directories.length) {
      files.push({
        toolId: "creation",
        path: "libraries.json",
        content:
          JSON.stringify({ libraryDirectories: directories }, null, 2) + "\n"
      });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return files;
}
