/** Launch the supported profile CLI with the application's own package manager. */
import { fileURLToPath } from "node:url";
import { runCli } from "@deepseek-ai/dsh/lib/bin.js";
await runCli({
  packageManager: {
    command: process.execPath,
    args: [
      fileURLToPath(
        new URL("./node_modules/pnpm/bin/pnpm.cjs", import.meta.url)
      ),
      "--pm-on-fail=ignore"
    ],
    env: {
      PATH: process.env.PATH ?? "",
      npm_config_pm_on_fail: "ignore"
    }
  }
});
