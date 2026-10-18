import { inject, type InjectionKey } from "vue";
import type { useWorkspaceShell } from "./useWorkspaceShell";
export const WORKSPACE_SHELL_CONTEXT: InjectionKey<
  ReturnType<typeof useWorkspaceShell>
> = Symbol("workspace-shell");
export function useWorkspaceShellContext() {
  const shell = inject(WORKSPACE_SHELL_CONTEXT);
  if (!shell) throw new Error("Workspace shell context is unavailable");
  return shell;
}
