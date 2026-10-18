import { app, crashReporter, dialog } from "electron";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  createStartupController,
  type StartupPhase
} from "./startup-controller";
import { createStartupLog, startupErrorCode } from "./startup-log";

const phaseLabels: Record<StartupPhase, string> = {
  runtime: "初始化运行环境",
  services: "初始化本地服务",
  workspace: "读取工作目录配置",
  "prompt-templates": "迁移提示词模板",
  appearance: "读取外观设置",
  settings: "读取常规设置",
  utilities: "启动后台服务",
  window: "加载主界面"
};

/** Install before app readiness so native startup crashes can leave a local dump. */
export function createDesktopStartup() {
  const directory = join(app.getPath("userData"), "diagnostics");
  const log = createStartupLog(directory);
  log.write(
    `start.${app.getVersion()}.${process.platform}.${process.arch}.electron-${process.versions.electron}`
  );
  try {
    const crashes = join(directory, "crashes");
    mkdirSync(crashes, { recursive: true });
    app.setPath("crashDumps", crashes);
    crashReporter.start({ uploadToServer: false });
    log.write("crash-reporter.ready");
  } catch (error) {
    log.write("crash-reporter.failed", { error });
  }
  process.on("uncaughtExceptionMonitor", (error) =>
    log.write("main.uncaught-exception", { error })
  );
  app.on("child-process-gone", (_event, details) => {
    log.write("child-process.gone", {
      processType: details.type,
      reason: details.reason,
      exitCode: details.exitCode
    });
  });
  app.on("render-process-gone", (_event, _contents, details) => {
    log.write("renderer.gone", {
      reason: details.reason,
      exitCode: details.exitCode
    });
  });
  return createStartupController(log, (phase, error) => {
    const code = startupErrorCode(error);
    try {
      if (process.env.DEEPWRITE_SMOKE === "1") {
        console.error(`DEEPWRITE_STARTUP_FAIL phase=${phase} code=${code}`);
      } else {
        dialog.showErrorBox(
          "DeepWrite 无法启动",
          `${phaseLabels[phase]}时发生错误（${code}）。\n\n${phase === "workspace" || phase === "settings" ? "请检查用户配置目录的访问权限和磁盘空间，再尝试启动。\n\n" : ""}请将下方本地诊断记录提供给开发者协助排查。\n\n记录位置（目录可写时生成）：\n${log.path}`
        );
      }
    } finally {
      // The renderer/IPC may not exist yet; the ordinary save-before-quit flow cannot run here.
      app.exit(1);
    }
  });
}
