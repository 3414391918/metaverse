import type {
  LibraryAgentDomain,
  LibraryAgentSkill,
  LongAgentId
} from "@deepwrite/contracts";
import { DEFAULT_LONG_AGENT_PROFILES } from "@deepwrite/contracts";

export interface AgentWelcomeContent {
  title: string;
  description: string;
  questions: readonly [string, string, string];
}

export const DEFAULT_AGENT_WELCOME: AgentWelcomeContent = {
  title: "从一个创作目标开始",
  description: "告诉我你想完成的创作任务，我会结合当前文稿与你一起推进。",
  questions: [
    "帮我梳理当前创作目标",
    "检查当前文稿的问题",
    "告诉我下一步可以做什么"
  ]
};

export const LIBRARY_AGENT_WELCOME_CONTENT = {
  skill: {
    title: "从创建一个技能开始",
    description:
      "我是技能库管理智能体，用于创建、整理和维护可复用的写作方法、检查清单与协作流程。",
    questions: ["初始化库介绍", "创建一个技能", "整理一个技能"]
  },
  material: {
    title: "从创建一个素材开始",
    description:
      "我是素材库管理智能体，用于创建、整理和维护可复用的小说素材条目。",
    questions: ["初始化库介绍", "创建一个素材", "整理一个素材"]
  }
} as const satisfies Record<LibraryAgentDomain, AgentWelcomeContent>;

export const LONG_AGENT_WELCOME_CONTENT = Object.fromEntries(
  DEFAULT_LONG_AGENT_PROFILES.map((profile) => [
    profile.id,
    {
      title: `从${profile.label.replace(/智能体$/u, "")}开始`,
      description: profile.description,
      questions: profile.welcomeShortcuts
    }
  ])
) as unknown as Record<LongAgentId, AgentWelcomeContent>;

export function resolveAgentWelcome(
  agentId: LongAgentId | undefined,
  libraryDomain?: LibraryAgentDomain,
  librarySkills?: readonly Pick<LibraryAgentSkill, "name">[],
  welcomeShortcuts?: readonly string[],
  _workspaceType: "long" = "long"
): AgentWelcomeContent {
  if (agentId)
    return withWelcomeShortcuts(
      LONG_AGENT_WELCOME_CONTENT[agentId] ?? DEFAULT_AGENT_WELCOME,
      welcomeShortcuts
    );
  if (libraryDomain) {
    const base = LIBRARY_AGENT_WELCOME_CONTENT[libraryDomain];
    if (!librarySkills?.length) {
      return base;
    }
    const questions = librarySkills.slice(0, 3).map((skill) => skill.name);
    while (questions.length < 3) {
      questions.push(base.questions[questions.length] ?? "");
    }
    return {
      ...base,
      questions: questions as [string, string, string]
    };
  }
  return DEFAULT_AGENT_WELCOME;
}

function withWelcomeShortcuts(
  base: AgentWelcomeContent,
  welcomeShortcuts?: readonly string[]
): AgentWelcomeContent {
  if (
    welcomeShortcuts?.length === 3 &&
    welcomeShortcuts.every(
      (value) => typeof value === "string" && value.trim().length > 0
    )
  ) {
    return {
      ...base,
      questions: [
        welcomeShortcuts[0]!.trim(),
        welcomeShortcuts[1]!.trim(),
        welcomeShortcuts[2]!.trim()
      ]
    };
  }
  return base;
}
