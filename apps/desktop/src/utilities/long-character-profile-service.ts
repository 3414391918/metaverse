import {
  LongDeleteCharacterAssetInputSchema,
  LongDeleteCharacterAppearanceInputSchema,
  type LongDeleteCharacterAppearanceInput,
  LongImportCharacterAssetsAtPathsInputSchema,
  LongReadCharacterProfileInputSchema,
  LongRenameCharacterAssetInputSchema,
  LongSaveCharacterProfileInputSchema,
  type LongDeleteCharacterAssetInput,
  type LongImportCharacterAssetsAtPathsInput,
  type LongReadCharacterProfileInput,
  type LongRenameCharacterAssetInput,
  type LongSaveCharacterProfileInput
} from "@deepwrite/contracts";
import type { LongProjectCatalog } from "./long-project-catalog";
import type { LongProjectStore } from "./long-project-store";

/** Registry resolution stays outside the physical profile and asset store. */
export class LongCharacterProfileService {
  constructor(
    private readonly catalog: LongProjectCatalog,
    private readonly store: LongProjectStore,
    private readonly refreshSummary: (
      projectDirectory: string,
      bookId: string
    ) => Promise<void>
  ) {}
  async readCharacterProfile(input: LongReadCharacterProfileInput) {
    const parsed = LongReadCharacterProfileInputSchema.parse(input);
    const opened = await this.catalog.open(parsed.bookId);
    return await this.store.readCharacterProfile(
      opened.projectDirectory,
      parsed
    );
  }
  async saveCharacterProfile(input: LongSaveCharacterProfileInput) {
    const parsed = LongSaveCharacterProfileInputSchema.parse(input);
    const opened = await this.catalog.open(parsed.bookId);
    const snapshot = await this.store.saveCharacterProfile(
      opened.projectDirectory,
      parsed
    );
    await this.refreshSummary(opened.projectDirectory, parsed.bookId);
    return snapshot;
  }
  async importCharacterAssetsAtPaths(
    input: LongImportCharacterAssetsAtPathsInput
  ) {
    const parsed = LongImportCharacterAssetsAtPathsInputSchema.parse(input);
    const opened = await this.catalog.open(parsed.bookId);
    return await this.store.importCharacterAssetsAtPaths(
      opened.projectDirectory,
      parsed
    );
  }
  async renameCharacterAsset(input: LongRenameCharacterAssetInput) {
    const parsed = LongRenameCharacterAssetInputSchema.parse(input);
    const opened = await this.catalog.open(parsed.bookId);
    return await this.store.renameCharacterAsset(
      opened.projectDirectory,
      parsed
    );
  }
  async deleteCharacterAsset(input: LongDeleteCharacterAssetInput) {
    const parsed = LongDeleteCharacterAssetInputSchema.parse(input);
    const opened = await this.catalog.open(parsed.bookId);
    return await this.store.deleteCharacterAsset(
      opened.projectDirectory,
      parsed
    );
  }
  async deleteCharacterAppearance(input: LongDeleteCharacterAppearanceInput) {
    const parsed = LongDeleteCharacterAppearanceInputSchema.parse(input);
    const opened = await this.catalog.open(parsed.bookId);
    const snapshot = await this.store.deleteCharacterAppearance(
      opened.projectDirectory,
      parsed
    );
    await this.refreshSummary(opened.projectDirectory, parsed.bookId);
    return snapshot;
  }
}
