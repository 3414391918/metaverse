import { readFileSync } from "node:fs";
import { registerSessionImport } from "./session-import.js";
/** Platform instructions inherit into each preset's normal prompt assembly and session log. */
export const inject = [
  "systemPrompt",
  "workspaceRegistry",
  "sessionPersistence",
  "attachments",
  "connection"
];
export async function apply(ctx) {
  const path = process.env.METAVERSE_ASSISTANT_GUIDE;
  if (!path) throw new Error("Missing Metaverse platform guide.");
  const root = process.env.METAVERSE_WORKSPACE_ROOT;
  if (!root) throw new Error("Missing Metaverse workspace root.");
  if (!(await ctx.workspaceRegistry.resolveByPath(root)))
    await ctx.workspaceRegistry.create(root);
  ctx.systemPrompt.section({
    name: "metaverse-platform",
    order: 50,
    interpolate: false,
    text: readFileSync(path, "utf8")
  });
  const disposeImport = await registerSessionImport(ctx, root);
  ctx.effect(() => disposeImport);
}
