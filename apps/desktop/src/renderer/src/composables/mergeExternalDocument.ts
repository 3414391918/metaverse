interface Change {
  start: number;
  end: number;
  replacement: string[];
}

const lines = (text: string): string[] =>
  text.match(/[^\n]*\n|[^\n]+$/gu) ?? [];

/** A bounded line diff; oversized edits become one explicit conflict region. */
function changes(base: string[], edited: string[]): Change[] {
  const n = base.length;
  const m = edited.length;
  if (n * m > 4_000_000) {
    let prefix = 0;
    while (prefix < n && prefix < m && base[prefix] === edited[prefix])
      prefix++;
    let suffix = 0;
    while (
      suffix < n - prefix &&
      suffix < m - prefix &&
      base[n - 1 - suffix] === edited[m - 1 - suffix]
    )
      suffix++;
    return prefix === n && prefix === m
      ? []
      : [
          {
            start: prefix,
            end: n - suffix,
            replacement: edited.slice(prefix, m - suffix)
          }
        ];
  }
  const width = m + 1;
  const lcs = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i * width + j] =
        base[i] === edited[j]
          ? lcs[(i + 1) * width + j + 1]! + 1
          : Math.max(lcs[(i + 1) * width + j]!, lcs[i * width + j + 1]!);
  const result: Change[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && base[i] === edited[j]) {
      i++;
      j++;
      continue;
    }
    const start = i;
    const replacement: string[] = [];
    while (i < n || j < m) {
      if (i < n && j < m && base[i] === edited[j]) break;
      if (
        j < m &&
        (i === n || lcs[i * width + j + 1]! > lcs[(i + 1) * width + j]!)
      )
        replacement.push(edited[j++]!);
      else if (i < n) i++;
      else replacement.push(edited[j++]!);
    }
    result.push({ start, end: i, replacement });
  }
  return result;
}

function overlaps(left: Change, right: Change): boolean {
  if (left.start === left.end && right.start === right.end)
    return left.start === right.start;
  if (left.start === left.end)
    return right.start <= left.start && left.start < right.end;
  if (right.start === right.end)
    return left.start <= right.start && right.start < left.end;
  return left.start < right.end && right.start < left.end;
}

function applyRange(
  base: string[],
  start: number,
  end: number,
  hunks: Change[]
): string {
  const output: string[] = [];
  let cursor = start;
  for (const hunk of hunks) {
    output.push(...base.slice(cursor, hunk.start), ...hunk.replacement);
    cursor = hunk.end;
  }
  output.push(...base.slice(cursor, end));
  return output.join("");
}

export function mergeExternalDocument(
  baseText: string,
  localText: string,
  remoteText: string
): { content: string; conflicts: boolean } {
  if (localText === baseText) return { content: remoteText, conflicts: false };
  if (remoteText === baseText || remoteText === localText)
    return { content: localText, conflicts: false };
  const base = lines(baseText);
  const local = changes(base, lines(localText));
  const remote = changes(base, lines(remoteText));
  const output: string[] = [];
  let cursor = 0;
  let li = 0;
  let ri = 0;
  let conflicts = false;
  while (li < local.length || ri < remote.length) {
    const left = local[li];
    const right = remote[ri];
    if (left && right && overlaps(left, right)) {
      const firstLeft = li++;
      const firstRight = ri++;
      const start = Math.min(left.start, right.start);
      let end = Math.max(left.end, right.end);
      let expanded = true;
      while (expanded) {
        expanded = false;
        for (const [items, index, consume] of [
          [local, li, () => li++],
          [remote, ri, () => ri++]
        ] as const) {
          const next = items[index];
          if (next && next.start < end && next.end > start) {
            end = Math.max(end, next.end);
            consume();
            expanded = true;
          }
        }
      }
      output.push(...base.slice(cursor, start));
      const mine = applyRange(base, start, end, local.slice(firstLeft, li));
      const theirs = applyRange(base, start, end, remote.slice(firstRight, ri));
      if (mine === theirs) output.push(mine);
      else {
        conflicts = true;
        output.push(
          `<<<<<<< 本地未保存\n${mine}${mine.endsWith("\n") ? "" : "\n"}=======\n${theirs}${theirs.endsWith("\n") ? "" : "\n"}>>>>>>> 外部修改\n`
        );
      }
      cursor = end;
      continue;
    }
    const chosen =
      !right || (left && left.start <= right.start) ? left! : right;
    if (chosen === left) li++;
    else ri++;
    output.push(...base.slice(cursor, chosen.start), ...chosen.replacement);
    cursor = chosen.end;
  }
  output.push(...base.slice(cursor));
  return { content: output.join(""), conflicts };
}

/** Re-anchor a caret by nearby text rather than a stale numeric offset. */
export function mapMergedOffset(
  before: string,
  after: string,
  offset: number
): number {
  const clamped = Math.max(0, Math.min(before.length, offset));
  if (before.slice(0, clamped) === after.slice(0, clamped)) return clamped;
  const preceding = before.slice(Math.max(0, clamped - 48), clamped);
  const following = before.slice(clamped, clamped + 48);
  const expected = Math.max(
    0,
    Math.min(after.length, clamped + after.length - before.length)
  );
  if (preceding) {
    let best: { offset: number; score: number } | undefined;
    for (
      let match = after.indexOf(preceding);
      match >= 0;
      match = after.indexOf(preceding, match + 1)
    ) {
      const candidate = match + preceding.length;
      const contextMatches =
        following && after.startsWith(following, candidate);
      const score =
        (contextMatches ? 0 : after.length + 1) +
        Math.abs(candidate - expected);
      if (!best || score < best.score) best = { offset: candidate, score };
    }
    if (best) return best.offset;
  }
  if (following) {
    let best = -1;
    for (
      let match = after.indexOf(following);
      match >= 0;
      match = after.indexOf(following, match + 1)
    )
      if (best < 0 || Math.abs(match - expected) < Math.abs(best - expected))
        best = match;
    if (best >= 0) return best;
  }
  return Math.min(after.length, clamped);
}
