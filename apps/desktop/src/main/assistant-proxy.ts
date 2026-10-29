const LOCAL_BYPASS = ["localhost", "127.0.0.1", "::1"];

/** Convert Chromium's resolved HTTP proxy route into Node and pi-ai settings. */
export function assistantProxyEnvironment(
  route: string,
  inherited: NodeJS.ProcessEnv
): NodeJS.ProcessEnv {
  const explicit =
    inherited.HTTPS_PROXY ??
    inherited.https_proxy ??
    inherited.ALL_PROXY ??
    inherited.all_proxy;
  let proxy: string | undefined;
  if (!explicit) {
    const first = route.split(";")[0]?.trim() ?? "";
    const match = /^(PROXY|HTTPS)\s+(\S+)$/u.exec(first);
    if (!match) return {};
    try {
      const candidate = new URL(
        `${match[1] === "HTTPS" ? "https" : "http"}://${match[2]}`
      );
      if (
        !candidate.hostname ||
        !candidate.port ||
        candidate.username ||
        candidate.password ||
        candidate.pathname !== "/" ||
        candidate.search ||
        candidate.hash
      )
        return {};
      proxy = candidate.origin;
    } catch {
      return {};
    }
  }

  const bypassKey = inherited.no_proxy !== undefined ? "no_proxy" : "NO_PROXY";
  const bypass = (inherited[bypassKey] ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!bypass.includes("*"))
    for (const host of LOCAL_BYPASS)
      if (!bypass.includes(host)) bypass.push(host);
  return {
    ...(proxy ? { HTTPS_PROXY: proxy, HTTP_PROXY: proxy } : {}),
    NODE_USE_ENV_PROXY: "1",
    [bypassKey]: bypass.join(",")
  };
}
