import state from "../composables/shell/state.ts?raw";
import editor from "../composables/shell/editor.ts?raw";
import libraries from "../composables/shell/libraries.ts?raw";
import features from "../composables/shell/features.ts?raw";
import tree from "../composables/shell/tree.ts?raw";
import novel from "../composables/shell/novel.ts?raw";
import novelTransactions from "../composables/shell/novelTransactions.ts?raw";
import resources from "../composables/shell/resources.ts?raw";
import conversations from "../composables/shell/conversations.ts?raw";
import resourceActions from "../composables/shell/resourceActions.ts?raw";
import proposals from "../composables/shell/proposals.ts?raw";
import lifecycle from "../composables/shell/lifecycle.ts?raw";
import template from "../components/WorkspaceShellContent.vue?raw";

/** Aggregate the composition modules for existing source boundary assertions. */
export default [
  state,
  editor,
  libraries,
  features,
  tree,
  novel,
  novelTransactions,
  resources,
  conversations,
  resourceActions,
  proposals,
  lifecycle,
  template
]
  .join("\n")
  .replace(/\bports\.\w+\./gu, "")
  .replace(/\bshell\./gu, "")
  .replace(/\b(\w+): \1\b/gu, "$1")
  .replace(/\.\.\/\.\.\//gu, "./")
  .replace(/deferShellAction\(\s*\(\) => (\w+)\s*\)/gu, "$1")
  .replace(
    /conversationRuntimeRegistryStorePort\(\s*(\w+)\s*\)/gu,
    "conversationRuntimeRegistryStorePort($1)"
  );
