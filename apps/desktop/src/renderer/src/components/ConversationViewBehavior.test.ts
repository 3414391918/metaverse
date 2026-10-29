import { describe, expect, it } from "vitest";
import messageListSource from "./ConversationMessageList.vue?raw";
import processingTimelineSource from "./ConversationProcessingTimeline.vue?raw";
import subagentSource from "./SubagentRunList.vue?raw";
import clockSource from "./ConversationRunClock.vue?raw";
import detailsSource from "./ConversationDetails.vue?raw";
import scrollSource from "../composables/useConversationScrollFollow.ts?raw";

describe("conversation view behavior", () => {
  it("does not rewrite the conversation scroll position for status-only proposal updates", () => {
    const tailFollowStart = scrollSource.indexOf(
      "function scheduleConversationTailFollow"
    );
    const tailFollowEnd = scrollSource.indexOf("\nwatch(", tailFollowStart);
    const tailFollow = scrollSource.slice(tailFollowStart, tailFollowEnd);

    expect(tailFollow).toContain("element.scrollHeight - element.clientHeight");
    expect(tailFollow).toContain(
      "Math.abs(element.scrollTop - tailScrollTop) > 1"
    );
    expect(tailFollow).not.toContain(
      "element.scrollTop = element.scrollHeight"
    );
  });

  it("locks tail following for the rest of a response after any upward scroll", () => {
    expect(scrollSource).toContain(
      "const tailFollowLockedForResponse = ref(false)"
    );
    expect(scrollSource).toContain(
      "function lockConversationTailForCurrentResponse"
    );
    expect(scrollSource).toContain("if (event.deltaY < 0)");
    expect(scrollSource).toContain(
      "nextScrollTop < lastConversationScrollTop - 1"
    );
    expect(scrollSource).toContain(
      "followsConversationTail.value = !tailFollowLockedForResponse.value"
    );
    expect(messageListSource).toContain(
      '@wheel.passive="handleConversationWheel"'
    );

    const responseResetStart = scrollSource.indexOf(
      "() => options.responding()"
    );
    const responseResetEnd = scrollSource.indexOf(
      "const message = lastAssistantMessage",
      responseResetStart
    );
    const responseReset = scrollSource.slice(
      responseResetStart,
      responseResetEnd
    );
    expect(responseReset).toContain("if (!responding || wasResponding) return");
    expect(responseReset).toContain(
      "tailFollowLockedForResponse.value = false"
    );
  });

  it("preserves the free-reading position when terminal cards move below the answer", () => {
    expect(scrollSource).toContain('previous.endsWith(":streaming")');
    expect(scrollSource).toContain(
      "const preservedScrollTop = element.scrollTop"
    );
    expect(scrollSource).toContain(
      "scroller.value.scrollTop = preservedScrollTop"
    );
  });

  it("shows the processed timer from the streaming assistant, not a list placeholder", () => {
    expect(messageListSource).not.toContain("hasStreamingAssistant");
    expect(messageListSource).not.toContain("正在思考");
    expect(messageListSource).not.toContain('class="thinking-row"');
    expect(messageListSource).not.toContain("已处理 1s");
    expect(messageListSource).not.toContain('class="processing-live-status"');
  });

  it("isolates elapsed clocks to active processing labels", () => {
    expect(messageListSource).not.toContain(":clock=");
    expect(processingTimelineSource).toContain(
      ":active=\"message.status === 'streaming' || Boolean(message.retry)\""
    );
    expect(subagentSource).toContain(":active=\"run.status === 'running'\"");
    expect(clockSource).toContain("useConversationActivityClock");
  });

  it("unmounts closed detail bodies while preserving native disclosure semantics", () => {
    expect(detailsSource).toContain(
      '<details :open="open" @toggle="handleToggle">'
    );
    expect(detailsSource).toContain(
      '<summary><slot name="summary" /></summary>'
    );
    expect(detailsSource).toContain('<slot v-if="open" />');
  });

  it("does not expose legacy resend controls in the history list", () => {
    expect(messageListSource).not.toContain("submitEditedMessage");
    expect(messageListSource).not.toContain("canRewriteHistory");
  });
});
