import { app, type BrowserWindow } from "electron";

/** Checks the supported public Preload surface in a disposable profile. */
export async function runUnifiedCreationSmoke(window: BrowserWindow) {
  if (
    process.env.DEEPWRITE_SMOKE !== "1" ||
    !app.getPath("userData").includes("deepwrite-electron-smoke-")
  ) {
    throw new Error("Unified creation smoke requires a disposable profile.");
  }
  const moduleUrl = process.env.DEEPWRITE_SMOKE_CHAPTER_IMAGE_MODULE;
  if (!moduleUrl)
    throw new Error("Prompt template renderer smoke module missing");
  return window.webContents.executeJavaScript(`(async () => {
    const api=window.deepwrite;
    if(api.catalog.createShortBook || api.catalog.createScriptBook || api.workspaceAgents || api.bookTemplates || api.learningImitation || api.deviceSync || api.cloudBackup || api.marketplace) {
      throw new Error("Retired APIs are still exposed");
    }
    const created=await api.long.create({title:"统一小说入口测试",genre:"悬疑"});
    if(!created?.book?.id || created.book.workspaceIndex.plot.volumes.length!==1 || created.book.workspaceIndex.chapters.length!==1) {
      throw new Error("Unified novel creation lost its initial structure");
    }
    const smoke=await import(${JSON.stringify(moduleUrl)});
    const promptTemplates=await smoke.runPromptTemplateRendererSmoke();
    const tools=await smoke.runToolManagerRendererSmoke();
    return {status:"ok",created:true,retiredApisAbsent:true,promptTemplates,tools};
  })()`);
}
