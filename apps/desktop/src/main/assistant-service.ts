import { resolve } from "node:path";
import { app, session } from "electron";
import { AssistantRuntime } from "./assistant-runtime";
let runtime: AssistantRuntime | undefined;
export function assistantRuntime(): AssistantRuntime {
  if (!runtime) {
    const base = app.isPackaged
      ? resolve(app.getAppPath() + ".unpacked", "out/harness")
      : resolve(__dirname, "../harness");
    runtime = new AssistantRuntime({
      executable: resolve(
        base,
        "node",
        process.platform === "win32" ? "node.exe" : "node"
      ),
      cli: resolve(base, "runtime/launch.mjs"),
      plugin: resolve(base, "plugin"),
      environment: { DSH_CLIENT_TITLE: "元宇宙" },
      proxyResolver: () =>
        session.defaultSession.resolveProxy(
          "https://api.venice.ai/api/v1/models"
        )
    });
  }
  return runtime;
}
export async function stopAssistant(): Promise<void> {
  await runtime?.stop();
}

export function isAssistantGuestUrl(value: string, initial = false): boolean {
  return runtime?.isGuestUrl(value, initial) ?? false;
}
