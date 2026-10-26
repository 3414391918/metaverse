import type { WorkspaceFeatureModule } from "../components/WorkspaceFeatureModules.types";
import type {
  ActiveFeature,
  WorkspaceFeatureHostCoordinatorOptions
} from "./workspaceFeatureHostTypes";
import type { buildSettingsFeatureModule } from "./settingsFeatureModule";

export function buildWorkspaceFeatureModule(
  feature: ActiveFeature,
  options: WorkspaceFeatureHostCoordinatorOptions,
  _agentTeamNavigationEpoch: number,
  buildSettingsModule?: typeof buildSettingsFeatureModule
): WorkspaceFeatureModule | null {
  switch (feature) {
    case "assistant":
      return { kind: "assistant" };
    case "resources":
      return { kind: "resources" };
    case "settings":
      return buildSettingsModule?.(options) ?? null;
    case "agent-team":
    case "revision-analysis":
    case "tools":
      return { kind: "tools" };
    case "voice-manager":
      return { kind: "voice-manager" };
    case "prompt-templates":
      return { kind: "prompt-templates" };
    case "conversation":
    case "long-workspace":
      return null;
  }
}
