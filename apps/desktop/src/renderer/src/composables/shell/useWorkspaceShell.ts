import { provide, proxyRefs } from "vue";
import { WORKSPACE_SHELL_CONTEXT } from "./shellContext";
import type { ShellRuntimePorts } from "./runtimePorts";
import { useShellState } from "./state";
import { useShellEditor } from "./editor";
import { useShellLibraries } from "./libraries";
import { useShellFeatures } from "./features";
import { useShellTree } from "./tree";
import { useShellNovel } from "./novel";
import { useShellNovelTransactions } from "./novelTransactions";
import { useShellResources } from "./resources";
import { useShellConversations } from "./conversations";
import { useShellResourceActions } from "./resourceActions";
import { useShellProposals } from "./proposals";
import { useShellLifecycle } from "./lifecycle";

export function useWorkspaceShell() {
  const ports: ShellRuntimePorts = {
    get state() {
      return state;
    },
    get editor() {
      return editor;
    },
    get libraries() {
      return libraries;
    },
    get features() {
      return features;
    },
    get tree() {
      return tree;
    },
    get novel() {
      return novel;
    },
    get novelTransactions() {
      return novelTransactions;
    },
    get resources() {
      return resources;
    },
    get conversations() {
      return conversations;
    },
    get resourceActions() {
      return resourceActions;
    },
    get proposals() {
      return proposals;
    },
    get lifecycle() {
      return lifecycle;
    }
  };
  const state: ShellRuntimePorts["state"] = useShellState(ports);
  const editor: ShellRuntimePorts["editor"] = useShellEditor(ports);
  const libraries: ShellRuntimePorts["libraries"] = useShellLibraries(ports);
  const features: ShellRuntimePorts["features"] = useShellFeatures(ports);
  const tree: ShellRuntimePorts["tree"] = useShellTree(ports);
  const novel: ShellRuntimePorts["novel"] = useShellNovel(ports);
  const novelTransactions: ShellRuntimePorts["novelTransactions"] =
    useShellNovelTransactions(ports);
  const resources: ShellRuntimePorts["resources"] = useShellResources(ports);
  const conversations: ShellRuntimePorts["conversations"] =
    useShellConversations(ports);
  const resourceActions: ShellRuntimePorts["resourceActions"] =
    useShellResourceActions(ports);
  const proposals: ShellRuntimePorts["proposals"] = useShellProposals(ports);
  const lifecycle: ShellRuntimePorts["lifecycle"] = useShellLifecycle(ports);
  const shell = proxyRefs({
    ...state,
    ...editor,
    ...libraries,
    ...features,
    ...tree,
    ...novel,
    ...novelTransactions,
    ...resources,
    ...conversations,
    ...resourceActions,
    ...proposals,
    ...lifecycle
  });
  provide(WORKSPACE_SHELL_CONTEXT, shell);
  return shell;
}
