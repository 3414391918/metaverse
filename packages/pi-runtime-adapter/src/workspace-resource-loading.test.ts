import { describe, expect, it, vi } from "vitest";
import {
  LONG_WORKSPACE_ROOTS,
  MATERIAL_KINDS,
  SKILL_KINDS,
  type WorkspaceRuntimeContext
} from "@deepwrite/contracts";
import { buildRuntimeUserPrompt } from "./prompts";
import { buildLongWorkspaceTools } from "./long-agent-tools";
import {
  resultText,
  profile,
  workspace,
  toolByName
} from "./long-agent-tools.test-support";

const attachedMaterials: WorkspaceRuntimeContext["attachedMaterials"] =
  MATERIAL_KINDS.map((kind) => ({
    id: `material-${kind}`,
    title: `参考-${kind}`,
    kind,
    source: "attached-material",
    content: `素材原文-${kind}`
  }));
const attachedSkills: WorkspaceRuntimeContext["attachedSkills"] =
  SKILL_KINDS.map((kind) => ({
    id: `skill-${kind}`,
    title: `方法-${kind}`,
    kind,
    source: "attached-skill",
    content: `技能原文-${kind}`
  }));

describe("creation resources across stages", () => {
  it.each(LONG_WORKSPACE_ROOTS)(
    "lists allowed kinds and loads original content in %s",
    async (stage) => {
      const current = workspace("long", stage);
      const activeProfile = profile("long");
      const attachments = { attachedMaterials, attachedSkills };
      const tools = buildLongWorkspaceTools({
        workspace: current,
        profile: activeProfile,
        sessionId: "session",
        runId: "run",
        ...attachments
      });
      const prompt = buildRuntimeUserPrompt({
        sessionId: "session",
        runId: "run",
        prompt: "参考资料",
        longAgentProfile: activeProfile,
        workspaceContext: { longWorkspace: current, ...attachments }
      });
      const query = toolByName(tools, "query_linked_material_entries");
      const listed = resultText(await query.execute("list", { mode: "list" }));
      for (const kind of activeProfile.readAccess.materialKinds) {
        expect(prompt).toContain(`参考-${kind}`);
        expect(listed).toContain(`material-${kind}`);
        expect(
          resultText(
            await query.execute("read", {
              mode: "read",
              entry_id: `material-${kind}`
            })
          )
        ).toContain(`素材原文-${kind}`);
      }
      for (const kind of activeProfile.readAccess.skillKinds) {
        expect(prompt).toContain(`方法-${kind}`);
        expect(
          resultText(
            await toolByName(tools, "load_skill").execute("load", {
              name: `方法-${kind}`
            })
          )
        ).toContain(`技能原文-${kind}`);
      }
    }
  );
  it("passes the configured profile scope to live Core queries", async () => {
    const queryMaterials = vi
      .fn()
      .mockResolvedValue({ status: "ok", entries: [], total: 0, notices: [] });
    const activeProfile = profile("long");
    activeProfile.readAccess.materialKinds = ["character"];
    const tools = buildLongWorkspaceTools({
      workspace: workspace("long", "character_design"),
      profile: activeProfile,
      sessionId: "session",
      runId: "run",
      queryMaterials
    });
    await toolByName(tools, "query_linked_material_entries").execute("query", {
      mode: "list"
    });
    expect(queryMaterials.mock.calls[0]?.[1]).toEqual(["character"]);
  });
});
