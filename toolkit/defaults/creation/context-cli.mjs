#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runContextAction } from "./runtime/context-engine.mjs";

const args = process.argv.slice(2);
if (!args.length || args.includes("--help"))
  console.log(
    "用法：node context-cli.mjs --input /请求.json [--workdir /工作目录]\n--input - 从 stdin 读取。参见 SKILL.md。"
  );
else {
  try {
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
      if (!["--input", "--workdir"].includes(args[i]) || !args[i + 1])
        throw new Error(`无效参数：${args[i]}`);
      options[args[i]] = args[i + 1];
    }
    if (!options["--input"]) throw new Error("请提供 --input 请求 JSON 文件。");
    let content = "";
    if (options["--input"] === "-") {
      for await (const chunk of process.stdin) content += chunk;
    } else content = await readFile(options["--input"], "utf8");
    const workdir =
      options["--workdir"] ??
      resolve(dirname(fileURLToPath(import.meta.url)), "../..");
    console.log(
      JSON.stringify(
        await runContextAction(workdir, JSON.parse(content)),
        null,
        2
      )
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error)
      })
    );
    process.exitCode = 1;
  }
}
