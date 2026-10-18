import { ref, shallowRef } from "vue";
import { describe, expect, it } from "vitest";
import type { AgentConversationController } from "./useAgentConversation";
import { useCurrentAgentActivityView } from "./useCurrentAgentActivityView";

function controller(): AgentConversationController {
  return {} as AgentConversationController;
}

describe("useCurrentAgentActivityView", () => {
  it("keeps a library activity target independent from a transient novel selection", () => {
    const libraryConversation = controller();
    const longConversation = controller();
    const activeFeature = ref("conversation");
    const libraryResourceId = ref("material-library:entry-two");
    const longResourceId = ref("long-book:chapter-two");
    const view = useCurrentAgentActivityView({
      activeFeature,
      libraryResourceId,
      longResourceId,
      libraryConversation: shallowRef(libraryConversation),
      libraryContext: ref({
        agentLabel: "素材管理子智能体",
        bookTitle: "素材库",
        contextTitle: "人物素材"
      }),
      longConversation: shallowRef(longConversation),
      longProfile: ref({ label: "主智能体" }),
      longBook: ref({ title: "小说作品" }),
      longSelection: ref({ title: "第二章", chapterCardId: "chapter-two" }),
      longRoot: ref("draft")
    });

    expect(view.value).toMatchObject({
      controller: libraryConversation,
      targetResourceId: "material-library:entry-two"
    });

    activeFeature.value = "long-workspace";
    expect(view.value).toMatchObject({
      controller: longConversation,
      targetResourceId: "long-book:chapter-two",
      chapterCardId: "chapter-two"
    });
  });
});
