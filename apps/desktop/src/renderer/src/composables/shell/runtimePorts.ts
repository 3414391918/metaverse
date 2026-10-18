import type { StateRuntime } from "./state.types";
import type { EditorRuntime } from "./editor.types";
import type { LibrariesRuntime } from "./libraries.types";
import type { FeaturesRuntime } from "./features.types";
import type { TreeRuntime } from "./tree.types";
import type { NovelRuntime } from "./novel.types";
import type { NovelTransactionsRuntime } from "./novelTransactions.types";
import type { ResourcesRuntime } from "./resources.types";
import type { ConversationsRuntime } from "./conversations.types";
import type { ResourceActionsRuntime } from "./resourceActions.types";
import type { ProposalsRuntime } from "./proposals.types";
import type { LifecycleRuntime } from "./lifecycle.types";
export interface ShellRuntimePorts {
  state: StateRuntime;
  editor: EditorRuntime;
  libraries: LibrariesRuntime;
  features: FeaturesRuntime;
  tree: TreeRuntime;
  novel: NovelRuntime;
  novelTransactions: NovelTransactionsRuntime;
  resources: ResourcesRuntime;
  conversations: ConversationsRuntime;
  resourceActions: ResourceActionsRuntime;
  proposals: ProposalsRuntime;
  lifecycle: LifecycleRuntime;
}
