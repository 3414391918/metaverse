import {
  LongAddChapterImageInputSchema,
  LongDeleteChapterImageInputSchema,
  type LongDeleteChapterImageInput,
  type LongAddChapterImageInput,
  LongReadChapterImageInputSchema,
  LongReplaceChapterImageInputSchema,
  type LongReadChapterImageInput,
  type LongReplaceChapterImageInput
} from "@deepwrite/contracts";
import type { LongProjectCatalog } from "./long-project-catalog";
import type { LongProjectStore } from "./long-project-store";

/** Registry resolution stays outside the physical chapter image store. */
export class LongChapterImageService {
  constructor(
    private readonly catalog: LongProjectCatalog,
    private readonly store: LongProjectStore
  ) {}

  async readChapterImage(input: LongReadChapterImageInput) {
    const parsed = LongReadChapterImageInputSchema.parse(input);
    const opened = await this.catalog.open(parsed.bookId);
    return await this.store.readChapterImage(opened.projectDirectory, parsed);
  }

  async copySource(input: LongReadChapterImageInput) {
    const parsed = LongReadChapterImageInputSchema.parse(input);
    const opened = await this.catalog.open(parsed.bookId);
    return await this.store.chapterImageCopySource(
      opened.projectDirectory,
      parsed
    );
  }

  async addChapterImage(input: LongAddChapterImageInput) {
    const parsed = LongAddChapterImageInputSchema.parse(input);
    const opened = await this.catalog.open(parsed.bookId);
    const result = await this.store.addChapterImage(
      opened.projectDirectory,
      parsed
    );
    await this.catalog
      .updateSummary(parsed.bookId, result.document.summary)
      .catch(() => undefined);
    return result;
  }

  async replaceChapterImage(input: LongReplaceChapterImageInput) {
    const parsed = LongReplaceChapterImageInputSchema.parse(input);
    const opened = await this.catalog.open(parsed.bookId);
    return await this.store.replaceChapterImage(
      opened.projectDirectory,
      parsed
    );
  }

  async deleteChapterImage(input: LongDeleteChapterImageInput) {
    const parsed = LongDeleteChapterImageInputSchema.parse(input);
    const opened = await this.catalog.open(parsed.bookId);
    const result = await this.store.deleteChapterImage(
      opened.projectDirectory,
      parsed
    );
    await this.catalog
      .updateSummary(parsed.bookId, result.document.summary)
      .catch(() => undefined);
    return result;
  }
}
