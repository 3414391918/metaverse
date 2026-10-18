#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { runWorkspaceAction } from "./runtime/engine.mjs";

const args = process.argv.slice(2);
if (args.includes("--help") || !args.length) {
  console.log(
    '用法：node cli.mjs --book /小说目录 --input /请求.json\n--input - 从 stdin 读取 JSON；create/schema 不需要 --book。\n请求格式：{"action":"index","input":{}}；详细说明见 SKILL.md。'
  );
} else {
  try {
    const options = {};
    for (let index = 0; index < args.length; index += 2) {
      const name = args[index];
      if (!["--book", "--input"].includes(name) || !args[index + 1])
        throw new Error(`无效参数：${name}`);
      options[name] = args[index + 1];
    }
    if (!options["--input"])
      throw new Error("请提供 --input 请求 JSON 文件，或使用 --input -。");
    let content;
    if (options["--input"] === "-") {
      content = "";
      for await (const chunk of process.stdin) content += chunk;
    } else content = await readFile(options["--input"], "utf8");
    const result = await runWorkspaceAction(
      options["--book"],
      JSON.parse(content)
    );
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error)
      })
    );
    process.exitCode = 1;
  }
}
