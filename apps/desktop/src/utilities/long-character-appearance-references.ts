import {
  LongGetCharacterAppearanceReferencesInputSchema,
  LongGetCharacterAppearanceReferencesResultSchema,
  type LongGetCharacterAppearanceReferencesInput,
  type LongCharacterAppearanceReferenceCharacter
} from "@deepwrite/contracts";
import { characterAppearanceStorage } from "./long-character-appearance-paths";
import type { LongWorkspaceService } from "./long-workspace-service";
import { join } from "node:path";

/** Read-only reference inventory; absolute paths come only from a registered book. */
export async function getCharacterAppearanceReferences(
  service: Pick<LongWorkspaceService, "catalog" | "store">,
  input: LongGetCharacterAppearanceReferencesInput
) {
  const parsed = LongGetCharacterAppearanceReferencesInputSchema.parse(input);
  const opened = await service.catalog.open(parsed.bookId);
  const index = opened.book.workspaceIndex;
  const target = index.characterFiles.find(
    (entry) => entry.characterId === parsed.characterId
  );
  if (!target) throw new Error("角色核心档案不存在。");
  const targetStorage = await characterAppearanceStorage(
    opened.projectDirectory,
    target.coreProfile.path
  );
  const characters: LongCharacterAppearanceReferenceCharacter[] = [];
  const typeOrder = new Map(
    index.characterTypes.map((type) => [type.id, type.order])
  );
  const ordered = [...index.characters].sort(
    (a, b) =>
      (typeOrder.get(a.group) ?? 0) - (typeOrder.get(b.group) ?? 0) ||
      a.order - b.order ||
      a.id.localeCompare(b.id)
  );
  for (const character of ordered) {
    const files = index.characterFiles.find(
      (entry) => entry.characterId === character.id
    );
    if (!files) continue;
    const snapshot = await service.store.readCharacterProfile(
      opened.projectDirectory,
      {
        bookId: parsed.bookId,
        characterId: character.id
      }
    );
    const paths = await characterAppearanceStorage(
      opened.projectDirectory,
      files.coreProfile.path,
      snapshot.assets.map(
        (asset) =>
          `${asset.directory ? `${asset.directory}/` : ""}${asset.filename}`
      )
    );
    const appearances = snapshot.profile.appearances.flatMap((appearance) => {
      const assets = snapshot.assets
        .filter((asset) => asset.appearanceId === appearance.id)
        .map(({ label, filename, directory }) => ({
          label,
          filename,
          ...(directory ? { directory } : {})
        }));
      return assets.length
        ? [
            {
              id: appearance.id,
              name: appearance.name,
              assets,
              ...(assets.every((a) => a.directory === appearance.id)
                ? {
                    assetsDirectory: join(paths.assetsDirectory, appearance.id)
                  }
                : {})
            }
          ]
        : [];
    });
    if (appearances.length) {
      characters.push({
        characterId: character.id,
        name: snapshot.profile.name,
        assetsDirectory: paths.assetsDirectory,
        assetsManifestPath: paths.assetsManifestPath,
        appearances
      });
    }
  }
  return LongGetCharacterAppearanceReferencesResultSchema.parse({
    ...parsed,
    target: targetStorage,
    characters
  });
}
