import { readFile } from "node:fs/promises";
import { createDesignedVoice, createSchema } from "./voice-design.mjs";

async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== "--input")
    throw new Error(
      "用法：node cli.mjs --input /请求.json（或 --input - 读取 stdin）"
    );
  const source = process.argv[3];
  let raw = "";
  if (source === "-") {
    for await (const chunk of process.stdin) raw += chunk;
  } else {
    raw = await readFile(source, "utf8");
  }
  const request = JSON.parse(raw);
  if (request?.action === "schema") {
    process.stdout.write(`${JSON.stringify({ schema: createSchema })}\n`);
    return;
  }
  if (request?.action !== "create") throw new Error("不支持的声音设计操作。");
  const result = await createDesignedVoice(
    request.input,
    process.env.FISH_AUDIO_API_KEY
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "声音设计失败。"}\n`
  );
  process.exitCode = 1;
});
