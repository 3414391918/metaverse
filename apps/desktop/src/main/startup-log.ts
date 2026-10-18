import {
  appendFileSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync
} from "node:fs";
import { join } from "node:path";

export interface StartupLogDetails {
  error?: unknown;
  reason?: string;
  exitCode?: number;
  processType?: string;
}

/** Never persist exception messages/stacks: they can contain credentials or manuscript text. */
export function startupErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "UNKNOWN";
  const code = "code" in error ? error.code : undefined;
  if (typeof code === "string" && /^[A-Z][A-Z_0-9]{0,63}$/.test(code))
    return code;
  if (typeof code === "number" && Number.isSafeInteger(code))
    return String(code);
  return "UNKNOWN";
}

export function createStartupLog(directory: string) {
  const path = join(directory, "startup.log");
  return {
    path,
    write(event: string, details: StartupLogDetails = {}): void {
      try {
        mkdirSync(directory, { recursive: true });
        try {
          if (statSync(path).size > 512 * 1024) {
            rmSync(`${path}.previous`, { force: true });
            renameSync(path, `${path}.previous`);
          }
        } catch {
          // A new profile has no log to rotate.
        }
        const entry = {
          time: new Date().toISOString(),
          pid: process.pid,
          event,
          ...(details.error !== undefined
            ? { errorCode: startupErrorCode(details.error) }
            : {}),
          ...(details.reason && /^[a-z-]{1,48}$/.test(details.reason)
            ? { reason: details.reason }
            : {}),
          ...(details.processType &&
          /^[A-Za-z -]{1,48}$/.test(details.processType)
            ? { processType: details.processType }
            : {}),
          ...(Number.isSafeInteger(details.exitCode)
            ? { exitCode: details.exitCode }
            : {})
        };
        appendFileSync(path, `${JSON.stringify(entry)}\n`, {
          encoding: "utf8",
          mode: 0o600
        });
      } catch {
        // Diagnostics must never prevent startup, including on read-only profiles.
      }
    }
  };
}

export type StartupLog = ReturnType<typeof createStartupLog>;
