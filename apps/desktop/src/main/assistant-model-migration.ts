/** Migrate only the app's former defaults; preserve other user-selected models. */
export function migrateLegacyDefaultModel(source: string): string {
  const lines = source.split(/(?<=\n)/u);
  let changed = false;
  for (let start = 0; start < lines.length; start++) {
    const row = /^([ \t]*)- id: agent-default-model[ \t]*(?:\r?\n)?$/u.exec(
      lines[start] ?? ""
    );
    if (!row) continue;
    const indentation = row[1]!.length;
    let end = start + 1;
    while (end < lines.length) {
      const line = lines[end] ?? "";
      const leading = /^[ \t]*/u.exec(line)?.[0].length ?? 0;
      if (leading <= indentation && /^- /u.test(line.slice(leading))) break;
      end++;
    }
    const provider = lines.findIndex(
      (line, index) =>
        index > start &&
        index < end &&
        /^[ \t]*provider:[ \t]*["']?(?:deepseek-(?:official|account)|venice)["']?[ \t]*(?:\r?\n)?$/u.test(
          line
        )
    );
    const model = lines.findIndex(
      (line, index) =>
        index > start && index < end && /^[ \t]*model:/u.test(line)
    );
    if (provider < 0 || model < 0) continue;
    const previousProvider = lines[provider] ?? "";
    if (
      /provider:[ \t]*["']?venice["']?/u.test(previousProvider) &&
      !/model:[ \t]*["']?(?:venice-uncensored-1-2|gemma-4-uncensored)["']?/u.test(
        lines[model] ?? ""
      )
    )
      continue;
    lines[provider] = lines[provider]!.replace(
      /provider:[^\r\n]*/u,
      "provider: venice"
    );
    lines[model] = lines[model]!.replace(
      /model:[^\r\n]*/u,
      "model: qwen-3-6-plus"
    );
    for (let index = start + 1; index < end; index++)
      if (/^[ \t]*reasoningEffort:/u.test(lines[index] ?? ""))
        lines[index] = "";
    changed = true;
    start = end - 1;
  }
  return changed ? lines.join("") : source;
}
