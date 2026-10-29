import { describe, expect, it } from "vitest";
import { assistantProxyEnvironment } from "./assistant-proxy";

describe("assistant proxy environment", () => {
  it("routes Venice through the macOS HTTP proxy and keeps local IPC direct", () => {
    expect(
      assistantProxyEnvironment("PROXY 127.0.0.1:7892; DIRECT", {})
    ).toEqual({
      HTTPS_PROXY: "http://127.0.0.1:7892",
      HTTP_PROXY: "http://127.0.0.1:7892",
      NODE_USE_ENV_PROXY: "1",
      NO_PROXY: "localhost,127.0.0.1,::1"
    });
  });

  it("preserves an explicit proxy and existing bypass list", () => {
    expect(
      assistantProxyEnvironment("PROXY 127.0.0.1:7892", {
        HTTPS_PROXY: "http://user-proxy:8080",
        NO_PROXY: "internal.example"
      })
    ).toEqual({
      NODE_USE_ENV_PROXY: "1",
      NO_PROXY: "internal.example,localhost,127.0.0.1,::1"
    });
  });

  it("does not invent a proxy for direct or unsupported routes", () => {
    expect(assistantProxyEnvironment("DIRECT", {})).toEqual({});
    expect(assistantProxyEnvironment("SOCKS5 127.0.0.1:7892", {})).toEqual({});
  });
});
