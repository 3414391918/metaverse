import {
  CatalogIndexSnapshotSchema,
  CatalogSnapshotSchema,
  ChatAssistantRuntimeContextSchema,
  CommandEnvelopeSchema,
  LongListBooksResultSchema,
  ModelSettingsSchema,
  ModelUsageDashboardSchema,
  createEnvelope,
  type ChatAssistantRuntimeContext,
  type SessionPromptCommandPayload
} from "@deepwrite/contracts";
import { createId } from "@deepwrite/shared";
import type { ChatAssistantProjectConfigStore } from "./chat-assistant-project-config-store";
import type { ModelConfigStore } from "./model-config-store";
import type { ModelUsageStore } from "./model-usage-store";
import type { UtilitySupervisor } from "./supervisor";

export interface ChatAssistantRuntimeContextDeps {
  requireModelConfigStore: () => ModelConfigStore;
  requireModelUsageStore: () => ModelUsageStore;
  requireChatAssistantProjectConfigStore: () => ChatAssistantProjectConfigStore;
  getAppVersion: () => string;
}

async function requireCorePayload(
  supervisor: UtilitySupervisor,
  type: "catalog.index" | "catalog.snapshot" | "long.list",
  schema: { parse(value: unknown): unknown }
): Promise<unknown> {
  const id = createId(`cmd_chat_assistant_${type.replaceAll(".", "_")}`);
  const command = CommandEnvelopeSchema.parse(
    createEnvelope(type, {}, { id, correlationId: id })
  );
  const result = await supervisor.requestCommand("core", command, 60_000);
  if (result.status === "rejected") {
    throw new Error(result.error.message);
  }
  return schema.parse(result.payload);
}

function chatAssistantUsageStart(days: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  if (days > 1) date.setDate(date.getDate() - (days - 1));
  return date.toISOString();
}

export async function resolveChatAssistantRuntimeContext(
  supervisor: UtilitySupervisor,
  payload: SessionPromptCommandPayload,
  deps: ChatAssistantRuntimeContextDeps
): Promise<ChatAssistantRuntimeContext> {
  const request = payload.chatAssistant ?? { mode: "normal" as const };
  if (request.mode === "roleplay") {
    const config = await deps
      .requireChatAssistantProjectConfigStore()
      .roleplay.get(request.roleId);
    return ChatAssistantRuntimeContextSchema.parse({
      mode: "roleplay",
      roleId: config.id,
      systemPrompt: config.systemPrompt
    });
  }
  const [catalog, longList, settings, today, sevenDays, thirtyDays, all] =
    await Promise.all([
      requireCorePayload(
        supervisor,
        "catalog.index",
        CatalogIndexSnapshotSchema
      ),
      requireCorePayload(supervisor, "long.list", LongListBooksResultSchema),
      deps.requireModelConfigStore().list(),
      deps
        .requireModelUsageStore()
        .query({ startAt: chatAssistantUsageStart(1) }),
      deps
        .requireModelUsageStore()
        .query({ startAt: chatAssistantUsageStart(7) }),
      deps
        .requireModelUsageStore()
        .query({ startAt: chatAssistantUsageStart(30) }),
      deps.requireModelUsageStore().query()
    ]);
  const modelSettings = ModelSettingsSchema.parse(settings);
  const base = {
    software: {
      name: "DeepWrite" as const,
      version: deps.getAppVersion(),
      platform: process.platform,
      arch: process.arch,
      currentTime: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    },
    catalog: CatalogIndexSnapshotSchema.parse(catalog),
    longBooks: LongListBooksResultSchema.parse(longList).books,
    models: modelSettings.models.map((model) => ({
      id: model.id,
      label: model.label,
      provider: model.provider,
      modelId: model.modelId,
      api: model.api,
      reasoning: model.reasoning,
      defaultThinkingLevel: model.defaultThinkingLevel,
      thinkingLevelOptions: model.thinkingLevelOptions,
      temperatureOptions: model.temperatureOptions,
      credentialConfigured: model.hasApiKey,
      ...(model.managedBy ? { managedBy: model.managedBy } : {}),
      ...(model.status !== undefined ? { status: model.status } : {}),
      ...(model.discount !== undefined ? { discount: model.discount } : {}),
      ...(model.input !== undefined ? { input: model.input } : {}),
      ...(model.output !== undefined ? { output: model.output } : {}),
      ...(model.cache !== undefined ? { cache: model.cache } : {})
    })),
    defaultModelId: modelSettings.defaultModelId,
    usage: {
      today: ModelUsageDashboardSchema.parse(today),
      "7d": ModelUsageDashboardSchema.parse(sevenDays),
      "30d": ModelUsageDashboardSchema.parse(thirtyDays),
      all: ModelUsageDashboardSchema.parse(all)
    }
  };
  if (request.mode === "normal") {
    return ChatAssistantRuntimeContextSchema.parse({ ...base, mode: "normal" });
  }
  const config = await deps
    .requireChatAssistantProjectConfigStore()
    .get(request.project);
  if (request.project.projectType === "long") {
    const projectBook = base.longBooks.find(
      (book) => book.id === request.project.projectId
    );
    if (!projectBook)
      throw new Error("所选长篇项目不存在或暂时不可用，请刷新后重试。");
    return ChatAssistantRuntimeContextSchema.parse({
      ...base,
      mode: "project",
      project: request.project,
      projectPrompt: config.systemPrompt,
      projectBook
    });
  }
  const snapshot = CatalogSnapshotSchema.parse(
    await requireCorePayload(
      supervisor,
      "catalog.snapshot",
      CatalogSnapshotSchema
    )
  );
  const projectBook = snapshot.books.find(
    (book) =>
      book.id === request.project.projectId &&
      book.bookType === request.project.projectType
  );
  if (!projectBook)
    throw new Error("所选创作项目不存在或暂时不可用，请刷新后重试。");
  return ChatAssistantRuntimeContextSchema.parse({
    ...base,
    mode: "project",
    project: request.project,
    projectPrompt: config.systemPrompt,
    projectBook
  });
}
