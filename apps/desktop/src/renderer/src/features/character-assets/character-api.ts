export function characterApi() {
  const api = window.deepwrite?.long;
  if (!api) throw new Error("桌面服务不可用，请在元宇宙桌面端打开。");
  return api;
}
