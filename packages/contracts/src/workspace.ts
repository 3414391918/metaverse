import { z } from "zod";
import {
  CreativePlotStageIdSchema,
  CreativePlotStagesSchema,
  type CreativePlotStageId
} from "./catalog";
import { EnvelopeBaseSchema } from "./envelope";
import {
  DraftSectionIdSchema,
  DraftSectionTitleSchema,
  SHORT_WORKSPACE_FILE_MAX_CHARACTERS
} from "./expert-draft";
import {
  ScriptWorkspaceAgentProfileSchema,
  ScriptWorkspaceAgentSettingsInputSchema,
  ScriptWorkspaceAgentSettingsSchema
} from "./script-agent-settings";
import {
  ScriptWorkspaceAgentIdSchema,
  ScriptWorkspaceSnapshotSchema,
  WorkspaceTypeSchema
} from "./script-workspace";
import {
  DEFAULT_SHORT_AGENT_READ_ACCESS,
  ShortAgentReadAccessSchema
} from "./short-agent-read-access";
import { DEFAULT_SHORT_SYSTEM_PROMPT } from "./writing-agent-prompts";
import { WRITING_CONTEXT_MAX_CHARACTERS } from "./writing-context";
export {
  DEFAULT_SHORT_CHARACTER_DESIGN_SYSTEM_PROMPT,
  DEFAULT_SHORT_EXPERT_DRAFT_COORDINATOR_SYSTEM_PROMPT,
  DEFAULT_SHORT_EXPERT_SECTION_WRITER_SYSTEM_PROMPT,
  DEFAULT_SHORT_PLOT_DESIGN_SYSTEM_PROMPT
} from "./legacy-writing-stage-prompts";
export * from "./short-agent-read-access";

export { DEFAULT_SHORT_SYSTEM_PROMPT } from "./writing-agent-prompts";

export const SHORT_WORKSPACE_STAGE_IDS = [
  "character_design",
  "worldbuilding",
  "plot_design",
  "intro_design",
  "plot_refine",
  "narrative_perspective",
  "outline",
  "draft"
] as const;

export const SHORT_DEFAULT_PLOT_STAGE_IDS = [
  "plot_design",
  "intro_design",
  "plot_refine"
] as const;
export const ShortDefaultPlotStageIdSchema = CreativePlotStageIdSchema;
export const ShortDefaultPlotStageIdsSchema = z
  .array(ShortDefaultPlotStageIdSchema)
  .min(1)
  .max(32)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Default short plot stage ids must be unique."
  });
export type ShortDefaultPlotStageId = z.infer<
  typeof ShortDefaultPlotStageIdSchema
>;

/** Physical text stages. `draft` is a virtual directory route. */
export const SHORT_WORKSPACE_TEXT_STAGE_IDS = [
  "character_design",
  "worldbuilding",
  "plot_design",
  "intro_design",
  "plot_refine",
  "narrative_perspective",
  "outline"
] as const;

export const ShortWorkspaceStageIdSchema = z.union([
  z.literal("character_design"),
  z.literal("draft"),
  CreativePlotStageIdSchema
]);
export type ShortWorkspaceStageId =
  "character_design" | "draft" | CreativePlotStageId;
export const ShortWorkspaceTextStageIdSchema = z.union([
  z.literal("character_design"),
  CreativePlotStageIdSchema
]);
export type ShortWorkspaceTextStageId = z.infer<
  typeof ShortWorkspaceTextStageIdSchema
>;

export const SHORT_WORKSPACE_AGENT_IDS = ["short"] as const;

/**
 * Historical short-agent ids remain stable conversation lanes only. They are
 * accepted at persistence boundaries and must never be exposed as live parent
 * agent identities again.
 */
export const SHORT_WORKSPACE_CONVERSATION_LANE_IDS = [
  "character_design",
  "plot_design",
  "expert_draft_coordinator"
] as const;
export const ShortWorkspaceConversationLaneIdSchema = z.enum(
  SHORT_WORKSPACE_CONVERSATION_LANE_IDS
);
export type ShortWorkspaceConversationLaneId = z.infer<
  typeof ShortWorkspaceConversationLaneIdSchema
>;

export const ShortWorkspaceAgentIdSchema = z.enum(SHORT_WORKSPACE_AGENT_IDS);
export type ShortWorkspaceAgentId = z.infer<typeof ShortWorkspaceAgentIdSchema>;

export function resolveShortWorkspaceAgentIdForStage(
  _stageId: ShortWorkspaceStageId
): ShortWorkspaceAgentId {
  return "short";
}

export function resolveShortWorkspaceConversationLaneIdForStage(
  stageId: ShortWorkspaceStageId
): ShortWorkspaceConversationLaneId {
  if (stageId === "character_design") return "character_design";
  if (stageId === "draft") return "expert_draft_coordinator";
  return "plot_design";
}

export const SHORT_WORKSPACE_PHASE_IDS = [
  "character",
  "plot",
  "draft"
] as const;
export const ShortWorkspacePhaseIdSchema = z.enum(SHORT_WORKSPACE_PHASE_IDS);
export type ShortWorkspacePhaseId = z.infer<typeof ShortWorkspacePhaseIdSchema>;

export function resolveShortWorkspacePhaseId(
  stageId: ShortWorkspaceStageId
): ShortWorkspacePhaseId {
  if (stageId === "character_design") return "character";
  if (stageId === "draft") return "draft";
  return "plot";
}

export function createShortWorkspaceContentRevision(content: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `v1:${content.length}:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/** Provisional section ids allocated in-run before catalog create lands. */
export const PROVISIONAL_EXPERT_DRAFT_SECTION_ID_PREFIX = "pending:section:";

export function isProvisionalExpertDraftSectionId(sectionId: string): boolean {
  return sectionId.startsWith(PROVISIONAL_EXPERT_DRAFT_SECTION_ID_PREFIX);
}

/**
 * Directory/structure revision for expert draft. Must NOT include body or
 * character-state content hashes — otherwise same-run content writes falsely
 * invalidate pending section-creation proposals.
 */
export function createExpertDraftDirectoryRevision(
  sections: ReadonlyArray<{
    id: string;
    title: string;
    wordCountRequirement: string;
  }>
): string {
  return createShortWorkspaceContentRevision(
    sections
      .map(
        (section) =>
          `${section.id}\u0000${section.title}\u0000${section.wordCountRequirement}`
      )
      .join("\u0001")
  );
}

/**
 * These defaults are copied byte-for-byte from write-claw's
 * app/prompt_defaults/short/shared/*.txt files, including the final newline.
 */
export const DEFAULT_SHORT_WORKSPACE_AGENT_SYSTEM_PROMPTS: Record<
  ShortWorkspaceAgentId,
  string
> = {
  short: DEFAULT_SHORT_SYSTEM_PROMPT
};

const ShortSystemPromptSchema = z
  .string()
  .min(1)
  .max(200_000)
  .refine((value) => value.trim().length > 0, {
    message: "System prompt must contain non-whitespace text."
  });

export const ShortWorkspaceStageSnapshotSchema = z
  .object({
    stageId: ShortWorkspaceTextStageIdSchema,
    title: z.string().trim().min(1).max(240),
    content: z.string().max(SHORT_WORKSPACE_FILE_MAX_CHARACTERS),
    revision: z.string().regex(/^v1:\d+:[0-9a-f]{8}$/),
    truncated: z.boolean().optional(),
    originalLength: z
      .number()
      .int()
      .nonnegative()
      .max(SHORT_WORKSPACE_FILE_MAX_CHARACTERS)
      .optional()
  })
  .superRefine((value, context) => {
    if (
      value.truncated === true &&
      (value.originalLength === undefined ||
        value.originalLength <= value.content.length)
    ) {
      context.addIssue({
        code: "custom",
        path: ["originalLength"],
        message:
          "A truncated stage must report an originalLength larger than content."
      });
    }
    if (value.truncated !== true && value.originalLength !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["originalLength"],
        message: "An untruncated stage must omit originalLength."
      });
    }
  });
export type ShortWorkspaceStageSnapshot = z.infer<
  typeof ShortWorkspaceStageSnapshotSchema
>;

export const ShortCharacterItemSnapshotSchema = z
  .object({
    id: z.string().trim().min(1).max(512),
    title: z.string().trim().min(1).max(256),
    order: z.number().int().positive(),
    content: z.string().max(SHORT_WORKSPACE_FILE_MAX_CHARACTERS),
    revision: z.string().regex(/^v1:\d+:[0-9a-f]{8}$/),
    truncated: z.boolean().optional(),
    originalLength: z
      .number()
      .int()
      .nonnegative()
      .max(SHORT_WORKSPACE_FILE_MAX_CHARACTERS)
      .optional()
  })
  .superRefine((value, context) => {
    if (
      value.truncated === true &&
      (value.originalLength === undefined ||
        value.originalLength <= value.content.length)
    ) {
      context.addIssue({
        code: "custom",
        path: ["originalLength"],
        message: "A truncated character item must report its original length."
      });
    }
    if (value.truncated !== true && value.originalLength !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["originalLength"],
        message: "An untruncated character item must omit originalLength."
      });
    }
  });
export type ShortCharacterItemSnapshot = z.infer<
  typeof ShortCharacterItemSnapshotSchema
>;

export const ShortCharacterStructureSnapshotSchema = z.discriminatedUnion(
  "format",
  [
    z.object({ format: z.literal("text") }),
    z.object({
      format: z.literal("list"),
      items: z.array(ShortCharacterItemSnapshotSchema).max(4_096)
    })
  ]
);
export type ShortCharacterStructureSnapshot = z.infer<
  typeof ShortCharacterStructureSnapshotSchema
>;

export const ExpertDraftFileSnapshotSchema = z.object({
  documentId: z.string().trim().min(1).max(4_096),
  // Character-state titles append a suffix to a valid 240-character section
  // title, so file snapshots follow CatalogDocument's 256-character limit.
  title: z.string().trim().min(1).max(256),
  content: z.string().max(SHORT_WORKSPACE_FILE_MAX_CHARACTERS),
  revision: z.string().regex(/^v1:\d+:[0-9a-f]{8}$/)
});
export type ExpertDraftFileSnapshot = z.infer<
  typeof ExpertDraftFileSnapshotSchema
>;

export const ExpertDraftSectionSnapshotSchema = z
  .object({
    id: DraftSectionIdSchema,
    title: DraftSectionTitleSchema,
    wordCountRequirement: z.string().max(1_000),
    body: ExpertDraftFileSnapshotSchema,
    characterState: ExpertDraftFileSnapshotSchema
  })
  .superRefine((value, context) => {
    if (value.body.documentId === value.characterState.documentId) {
      context.addIssue({
        code: "custom",
        path: ["characterState", "documentId"],
        message:
          "Expert draft body and character state must use distinct files."
      });
    }
  });
export type ExpertDraftSectionSnapshot = z.infer<
  typeof ExpertDraftSectionSnapshotSchema
>;

export const ExpertDraftDirectorySnapshotSchema = z
  .object({
    id: z.literal("draft"),
    title: z.string().trim().min(1).max(240),
    revision: z.string().regex(/^v1:\d+:[0-9a-f]{8}$/),
    sections: z.array(ExpertDraftSectionSnapshotSchema).min(1).max(100)
  })
  .superRefine((value, context) => {
    const sectionIds = value.sections.map((section) => section.id);
    sectionIds.forEach((sectionId, index) => {
      if (sectionIds.indexOf(sectionId) !== index) {
        context.addIssue({
          code: "custom",
          path: ["sections", index, "id"],
          message: `Duplicate expert draft section id: ${sectionId}`
        });
      }
    });

    const documentIds = value.sections.flatMap((section) => [
      section.body.documentId,
      section.characterState.documentId
    ]);
    documentIds.forEach((documentId, index) => {
      if (documentIds.indexOf(documentId) !== index) {
        const sectionIndex = Math.floor(index / 2);
        const fileField = index % 2 === 0 ? "body" : "characterState";
        context.addIssue({
          code: "custom",
          path: ["sections", sectionIndex, fileField, "documentId"],
          message: `Duplicate expert draft document id: ${documentId}`
        });
      }
    });
  });
export type ExpertDraftDirectorySnapshot = z.infer<
  typeof ExpertDraftDirectorySnapshotSchema
>;

const ShortWorkspaceSnapshotAgentIdSchema = z
  .union([ShortWorkspaceAgentIdSchema, ShortWorkspaceConversationLaneIdSchema])
  .transform(() => "short" as const);

export const ShortWorkspaceSnapshotSchema = z
  .object({
    id: z.string().trim().min(1).max(240),
    title: z.string().trim().min(1).max(240),
    categories: z.array(z.string().trim().min(1).max(120)).max(16),
    activeStageId: ShortWorkspaceStageIdSchema,
    activeAgentId: ShortWorkspaceSnapshotAgentIdSchema.optional(),
    activeSectionId: z.string().trim().min(1).max(120).optional(),
    agentsMd: z.string().max(WRITING_CONTEXT_MAX_CHARACTERS).optional(),
    plotStages: CreativePlotStagesSchema,
    characterStructure: ShortCharacterStructureSnapshotSchema.default({
      format: "text"
    }),
    expertDraft: ExpertDraftDirectorySnapshotSchema,
    stages: z.array(ShortWorkspaceStageSnapshotSchema).min(2).max(33)
  })
  .superRefine((value, context) => {
    const stageIds = value.stages.map((stage) => stage.stageId);
    stageIds.forEach((stageId, index) => {
      if (stageIds.indexOf(stageId) !== index) {
        context.addIssue({
          code: "custom",
          path: ["stages", index, "stageId"],
          message: `Duplicate workspace stage snapshot: ${stageId}`
        });
      }
    });
    const expectedStageIds = [
      "character_design",
      ...value.plotStages.map((stage) => stage.id)
    ];
    if (
      expectedStageIds.length !== stageIds.length ||
      expectedStageIds.some((stageId, index) => stageIds[index] !== stageId)
    ) {
      context.addIssue({
        code: "custom",
        path: ["stages"],
        message:
          "Workspace text stages must contain character design followed by configured plot stages."
      });
    }
    if (
      value.activeStageId !== "draft" &&
      !stageIds.includes(value.activeStageId)
    ) {
      context.addIssue({
        code: "custom",
        path: ["activeStageId"],
        message: "Active stage must be present in the workspace snapshot."
      });
    }

    if (value.activeStageId !== "draft") {
      const defaultAgentId = resolveShortWorkspaceAgentIdForStage(
        value.activeStageId
      );
      if (
        value.activeAgentId !== undefined &&
        value.activeAgentId !== defaultAgentId
      ) {
        context.addIssue({
          code: "custom",
          path: ["activeAgentId"],
          message: `Stage ${value.activeStageId} must use its default agent ${defaultAgentId}.`
        });
      }
      if (value.activeSectionId !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["activeSectionId"],
          message: "Only the draft stage may target a section."
        });
      }
      return;
    }

    if (value.activeAgentId !== undefined && value.activeAgentId !== "short") {
      context.addIssue({
        code: "custom",
        path: ["activeAgentId"],
        message: "The draft stage must use the unified short agent."
      });
      return;
    }

    if (value.activeSectionId === undefined) return;

    const sectionExists = value.expertDraft.sections.some(
      (section) => section.id === value.activeSectionId
    );
    if (!sectionExists) {
      context.addIssue({
        code: "custom",
        path: ["activeSectionId"],
        message: `Unknown expert draft section: ${value.activeSectionId}`
      });
    }
  });
export type ShortWorkspaceSnapshot = z.infer<
  typeof ShortWorkspaceSnapshotSchema
>;

export const SHORT_AGENT_WELCOME_SHORTCUT_MAX_LENGTH = 120;

export const ShortAgentWelcomeShortcutsSchema = z.tuple([
  z.string().trim().min(1).max(SHORT_AGENT_WELCOME_SHORTCUT_MAX_LENGTH),
  z.string().trim().min(1).max(SHORT_AGENT_WELCOME_SHORTCUT_MAX_LENGTH),
  z.string().trim().min(1).max(SHORT_AGENT_WELCOME_SHORTCUT_MAX_LENGTH)
]);
export type ShortAgentWelcomeShortcuts = z.infer<
  typeof ShortAgentWelcomeShortcutsSchema
>;

export const DEFAULT_SHORT_AGENT_WELCOME_SHORTCUTS = {
  short: [
    "根据当前阶段继续完善作品",
    "检查当前内容与前后阶段是否一致",
    "读取相关资料并给出可直接写回的成稿"
  ]
} as const satisfies Record<ShortWorkspaceAgentId, ShortAgentWelcomeShortcuts>;

export const ShortWorkspaceAgentProfileSchema = z.object({
  id: ShortWorkspaceAgentIdSchema,
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1_000),
  systemPrompt: ShortSystemPromptSchema,
  welcomeShortcuts: ShortAgentWelcomeShortcutsSchema,
  readAccess: ShortAgentReadAccessSchema
});
export type ShortWorkspaceAgentProfile = z.infer<
  typeof ShortWorkspaceAgentProfileSchema
>;

export const DEFAULT_SHORT_WORKSPACE_AGENT_PROFILES: readonly ShortWorkspaceAgentProfile[] =
  [
    {
      id: "short",
      label: "短篇智能体",
      description:
        "统一负责人物、动态剧情阶段和正文创作，并按当前阶段加载上下文。",
      systemPrompt: DEFAULT_SHORT_SYSTEM_PROMPT,
      welcomeShortcuts: [...DEFAULT_SHORT_AGENT_WELCOME_SHORTCUTS.short],
      readAccess: DEFAULT_SHORT_AGENT_READ_ACCESS.short
    }
  ];

function validateCompleteAgentSet(
  agents: readonly { id: ShortWorkspaceAgentId }[],
  context: z.core.$RefinementCtx<unknown>
): void {
  const ids = agents.map((agent) => agent.id);
  ids.forEach((id, index) => {
    if (ids.indexOf(id) !== index) {
      context.addIssue({
        code: "custom",
        path: ["agents", index, "id"],
        message: `Duplicate workspace agent profile: ${id}`
      });
    }
  });
}

export const ShortWorkspaceAgentSettingsSchema = z
  .object({
    workspaceType: z.literal("short"),
    defaultPlotStageIds: ShortDefaultPlotStageIdsSchema.default([
      ...SHORT_DEFAULT_PLOT_STAGE_IDS
    ]),
    agents: z
      .array(ShortWorkspaceAgentProfileSchema)
      .length(SHORT_WORKSPACE_AGENT_IDS.length)
  })
  .superRefine((value, context) =>
    validateCompleteAgentSet(value.agents, context)
  );
export type ShortWorkspaceAgentSettings = z.infer<
  typeof ShortWorkspaceAgentSettingsSchema
>;

export const ShortWorkspaceAgentSettingsInputAgentSchema = z.object({
  id: ShortWorkspaceAgentIdSchema,
  systemPrompt: ShortSystemPromptSchema,
  welcomeShortcuts: ShortAgentWelcomeShortcutsSchema,
  readAccess: ShortAgentReadAccessSchema
});
export type ShortWorkspaceAgentSettingsInputAgent = z.infer<
  typeof ShortWorkspaceAgentSettingsInputAgentSchema
>;

export const ShortWorkspaceAgentSettingsInputSchema = z
  .object({
    workspaceType: z.literal("short"),
    defaultPlotStageIds: ShortDefaultPlotStageIdsSchema.default([
      ...SHORT_DEFAULT_PLOT_STAGE_IDS
    ]),
    agents: z
      .array(ShortWorkspaceAgentSettingsInputAgentSchema)
      .length(SHORT_WORKSPACE_AGENT_IDS.length)
  })
  .superRefine((value, context) =>
    validateCompleteAgentSet(value.agents, context)
  );
export type ShortWorkspaceAgentSettingsInput = z.infer<
  typeof ShortWorkspaceAgentSettingsInputSchema
>;

export const DEFAULT_SHORT_WORKSPACE_AGENT_SETTINGS: ShortWorkspaceAgentSettings =
  {
    workspaceType: "short",
    defaultPlotStageIds: [...SHORT_DEFAULT_PLOT_STAGE_IDS],
    agents: [...DEFAULT_SHORT_WORKSPACE_AGENT_PROFILES]
  };

/** Shared unions for callers that handle both isolated creative workspaces. */
export const WorkspaceAgentIdSchema = z.union([
  ShortWorkspaceAgentIdSchema,
  ScriptWorkspaceAgentIdSchema
]);
export type WorkspaceAgentId = z.infer<typeof WorkspaceAgentIdSchema>;

export const WorkspaceAgentProfileSchema = z.union([
  ShortWorkspaceAgentProfileSchema,
  ScriptWorkspaceAgentProfileSchema
]);
export type WorkspaceAgentProfile = z.infer<typeof WorkspaceAgentProfileSchema>;

export const CreativeWorkspaceSnapshotSchema = z.union([
  ShortWorkspaceSnapshotSchema,
  ScriptWorkspaceSnapshotSchema
]);
export type CreativeWorkspaceSnapshot = z.infer<
  typeof CreativeWorkspaceSnapshotSchema
>;

export const WorkspaceAgentSettingsSchema = z.discriminatedUnion(
  "workspaceType",
  [ShortWorkspaceAgentSettingsSchema, ScriptWorkspaceAgentSettingsSchema]
);
export type WorkspaceAgentSettings = z.infer<
  typeof WorkspaceAgentSettingsSchema
>;

export const WorkspaceAgentSettingsInputSchema = z.discriminatedUnion(
  "workspaceType",
  [
    ShortWorkspaceAgentSettingsInputSchema,
    ScriptWorkspaceAgentSettingsInputSchema
  ]
);
export type WorkspaceAgentSettingsInput = z.infer<
  typeof WorkspaceAgentSettingsInputSchema
>;

export const WorkspaceAgentsListCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("workspaceAgents.list"),
    payload: z.object({ workspaceType: WorkspaceTypeSchema })
  });

export const WorkspaceAgentsSaveCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("workspaceAgents.save"),
    payload: WorkspaceAgentSettingsInputSchema
  });

export const WorkspaceAgentsResetCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("workspaceAgents.reset"),
    payload: z.discriminatedUnion("workspaceType", [
      z.object({
        workspaceType: z.literal("short"),
        agentId: ShortWorkspaceAgentIdSchema.optional()
      }),
      z.object({
        workspaceType: z.literal("script"),
        agentId: ScriptWorkspaceAgentIdSchema.optional()
      })
    ])
  });

export type WorkspaceAgentsListCommandEnvelope = z.infer<
  typeof WorkspaceAgentsListCommandEnvelopeSchema
>;
export type WorkspaceAgentsSaveCommandEnvelope = z.infer<
  typeof WorkspaceAgentsSaveCommandEnvelopeSchema
>;
export type WorkspaceAgentsResetCommandEnvelope = z.infer<
  typeof WorkspaceAgentsResetCommandEnvelopeSchema
>;
