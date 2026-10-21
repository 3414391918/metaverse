export type AppView = "workspace" | "settings";

export type WorkspaceMainView =
  | "tools"
  | "conversation"
  | "revision-analysis"
  | "voice-manager"
  | "prompt-templates"
  | "agent-team";

export type PrimaryFeature =
  | "tools"
  | "revision-analysis"
  | "voice-manager"
  | "prompt-templates"
  | "agent-teams";

export function primaryFeatureForView(
  view: WorkspaceMainView
): PrimaryFeature | undefined {
  switch (view) {
    case "tools":
      return "tools";
    case "agent-team":
      return "agent-teams";
    case "revision-analysis":
    case "voice-manager":
    case "prompt-templates":
      return view;
    default:
      return undefined;
  }
}
