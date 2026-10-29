import { describe, expect, it } from "vitest";
import messageItemSource from "./ConversationMessageItem.vue?raw";
import messageListSource from "./ConversationMessageList.vue?raw";

/** Historical messages remain readable, but never start a retired model run. */
describe("read-only conversation history presentation", () => {
  it("keeps content, attachments and copy actions", () => {
    expect(messageItemSource).toContain("message.content");
    expect(messageItemSource).toContain("message.attachments");
    expect(messageItemSource).toContain("navigator.clipboard.writeText");
    expect(messageListSource).toContain("useConversationContentGroups");
  });
  it("does not offer inline editing, resend or execution handlers", () => {
    for (const source of [messageItemSource, messageListSource]) {
      expect(source).not.toContain("submitEditedMessage");
      expect(source).not.toContain("ConversationUserMessageEditor");
      expect(source).not.toContain("requestEdit");
      expect(source).not.toContain("修改并重新发送");
    }
  });
});
