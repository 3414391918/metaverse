import type { BrowserWindow } from "electron";
import type { SystemHealthPayload } from "@deepwrite/contracts";
import type { UtilitySupervisor } from "./supervisor";
import { runUnifiedCreationSmoke } from "./smoke-unified-creation";
import { runConversationSmoke } from "./smoke-conversation";
import { runChapterImageSmoke } from "./smoke-chapter-images";
import { runCharacterAppearanceSmoke } from "./smoke-character-appearances";

export async function runApplicationSmoke(
  health: SystemHealthPayload,
  supervisor: UtilitySupervisor,
  window: BrowserWindow
): Promise<void> {
  const unifiedCreation = await runUnifiedCreationSmoke(window);
  const conversation = await runConversationSmoke(window);
  const chapterImages = await runChapterImageSmoke(supervisor, window);
  const characterAppearances = await runCharacterAppearanceSmoke(
    supervisor,
    window
  );
  console.log(
    `DEEPWRITE_SMOKE_OK ${JSON.stringify({
      health,
      unifiedCreation,
      conversation,
      chapterImages,
      characterAppearances
    })}`
  );
}
