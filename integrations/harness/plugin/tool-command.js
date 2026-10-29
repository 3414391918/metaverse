/** Keep the visible chip separate from the instructions sent to the agent. */
export function createToolClaim(
  tool,
  sessionId,
  sessions,
  conversation,
  remoteSession
) {
  const entry = `${tool.directory}/${tool.entryFile}`;
  return {
    name: "tool",
    token: `/${tool.name} `,
    hint: "输入任务",
    async submit(args) {
      const binding = sessions.binding(sessionId);
      if (!binding) throw new Error("当前会话已关闭。");
      const selected = binding.session.projections
        ?.faceOf("modelSelection")
        ?.getSnapshot()?.next;
      if (
        selected?.provider === "venice" &&
        ["venice-uncensored-1-2", "gemma-4-uncensored"].includes(selected.model)
      ) {
        if (!remoteSession)
          throw new Error("无法切换到支持工具调用的模型，请重试。");
        const result = await remoteSession.selectModel({
          sessionId,
          provider: "venice",
          model: "qwen-3-6-plus"
        });
        if (!result.ok)
          throw new Error(
            `无法切换到支持工具调用的模型：${result.error.message}`
          );
      }
      return conversation.sendSession(
        binding.session,
        `请使用元宇宙工具「${tool.name}」完成下面的任务。先读取工具入口 ${JSON.stringify(entry)}，再按工具说明执行。\n\n${args}`,
        [],
        "queue"
      );
    }
  };
}

/** Only consume an actual command trigger; existing task text belongs to the user. */
export function beginToolCommand(input, claim, schedule = (callback) => setTimeout(callback, 0)) {
  const snapshot = input.state.getSnapshot();
  const leading =
    snapshot.claim?.token ??
    /^\/tool(?:\s+|$)/u.exec(snapshot.draft)?.[0] ??
    (snapshot.draft === "/" ? "/" : "");
  const applied = input.beginCommand(claim, {
    start: 0,
    end: leading.length,
    draftRev: snapshot.draftRev
  });
  if (!applied) return false;

  // The picker can restore the old DOM selection when it closes. Move the
  // caret after that close, using Harness's own revision-guarded editor action.
  const selectedRev = input.state.getSnapshot().draftRev;
  schedule(() => {
    const current = input.state.getSnapshot();
    if (current.draftRev !== selectedRev || current.claim?.token !== claim.token)
      return;
    const referencesWidth = (current.occurrences ?? []).reduce(
      (width, ref) => width + ref.clipboardText.length - 1,
      0
    );
    const end = current.draft.length - claim.token.trimEnd().length + 1 - referencesWidth;
    if (end < 1) return;
    const caret = input.caretSpan?.();
    if (!caret || caret.start !== end || caret.end !== end) {
      if (!input.actions?.insertText("", {
        start: end,
        end,
        draftRev: current.draftRev
      })) return;
    }
    input.editor?.focus();
  });
  return true;
}

/** Rebuild the chip when Harness restores a persisted composer draft. */
export function createToolRestoreSource(listTools, sessions, conversation, remoteSession) {
  return {
    trigger: "/",
    name: "metaverse-tool-restore",
    showGroupTitle: false,
    async candidates() { return []; },
    onPick() { return undefined; },
    async matchClaim(session, token, signal) {
      if (!token.startsWith("/")) return undefined;
      const tools = await listTools();
      if (signal.aborted) return undefined;
      const tool = tools.find((item) => `/${item.name}` === token);
      return tool
        ? createToolClaim(tool, session.sessionId, sessions, conversation, remoteSession)
        : undefined;
    }
  };
}

/** Decode only our exact instruction envelope, leaving ordinary messages alone. */
export function parseToolRequest(text) {
  const match = /^请使用元宇宙工具「([^」]+)」完成下面的任务。先读取工具入口 .+?，再按工具说明执行。\n\n([\s\S]*)$/u.exec(text);
  return match ? { name: match[1], task: match[2] } : undefined;
}
