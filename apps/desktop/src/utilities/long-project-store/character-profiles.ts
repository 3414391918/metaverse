import {
  LongReadCharacterProfileInputSchema,
  LongSaveCharacterProfileInputSchema,
  type LongReadCharacterProfileInput,
  type LongSaveCharacterProfileInput
} from "@deepwrite/contracts";
import { commitProjectTransaction } from "../project-transaction";
import {
  assertCharacterAssetsAppearances,
  characterProfileSnapshot,
  loadCharacterProfileState
} from "./character-profile-context";
import { secureDirectory } from "./io";
import { characterProfileWriteOperations } from "./character-profile-write";
import type { LongProjectStoreContext } from "./store-context";
import { MAX_LEDGER_RECORD_BYTES } from "./types";

export async function readCharacterProfile(
  ctx: LongProjectStoreContext,
  projectDirectory: string,
  input: LongReadCharacterProfileInput
) {
  const parsed = LongReadCharacterProfileInputSchema.parse(input);
  const canonical = await secureDirectory(projectDirectory, "长篇项目目录");
  return await ctx.runExclusive(canonical, async () =>
    characterProfileSnapshot(
      await loadCharacterProfileState(ctx, canonical, parsed)
    )
  );
}

export async function saveCharacterProfile(
  ctx: LongProjectStoreContext,
  projectDirectory: string,
  input: LongSaveCharacterProfileInput
) {
  const parsed = LongSaveCharacterProfileInputSchema.parse(input);
  const canonical = await secureDirectory(projectDirectory, "长篇项目目录");
  return await ctx.runExclusive(canonical, async () => {
    const state = await loadCharacterProfileState(ctx, canonical, parsed);
    if (characterProfileSnapshot(state).revision !== parsed.expectedRevision)
      throw new Error(
        "角色档案已在其他位置更新。请重新读取后再保存，避免覆盖较新的修改。"
      );
    assertCharacterAssetsAppearances(parsed.profile, state.manifest);
    const operations = characterProfileWriteOperations(
      state,
      parsed.profile,
      ctx.timestamp()
    );
    // Keep the generic transaction's optimistic checks for this explicit form save.
    await commitProjectTransaction({
      projectRoot: canonical,
      operations,
      maxFileBytes: MAX_LEDGER_RECORD_BYTES
    });
    return characterProfileSnapshot(
      await loadCharacterProfileState(ctx, canonical, parsed)
    );
  });
}
