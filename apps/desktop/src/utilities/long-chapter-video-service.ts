import {
  LongAddChapterVideoInputSchema,
  LongDeleteChapterVideoInputSchema,
  LongReadChapterVideoInputSchema,
  LongReplaceChapterVideoInputSchema,
  type LongAddChapterVideoInput,
  type LongDeleteChapterVideoInput,
  type LongReadChapterVideoInput,
  type LongReplaceChapterVideoInput
} from "@deepwrite/contracts";
import type { LongProjectCatalog } from "./long-project-catalog";
import type { LongProjectStore } from "./long-project-store";

export class LongChapterVideoService {
  constructor(
    private readonly catalog: LongProjectCatalog,
    private readonly store: LongProjectStore
  ) {}

  async read(input: LongReadChapterVideoInput) {
    const parsed = LongReadChapterVideoInputSchema.parse(input);
    const opened = await this.catalog.open(parsed.bookId);
    return this.store.readChapterVideo(opened.projectDirectory, parsed);
  }
  async copySource(input: LongReadChapterVideoInput) {
    const parsed = LongReadChapterVideoInputSchema.parse(input);
    const opened = await this.catalog.open(parsed.bookId);
    return this.store.chapterVideoCopySource(opened.projectDirectory, parsed);
  }
  async add(input: LongAddChapterVideoInput) {
    const parsed = LongAddChapterVideoInputSchema.parse(input);
    const opened = await this.catalog.open(parsed.bookId);
    const result = await this.store.addChapterVideo(
      opened.projectDirectory,
      parsed
    );
    await this.catalog
      .updateSummary(parsed.bookId, result.document.summary)
      .catch(() => undefined);
    return result;
  }
  async replace(input: LongReplaceChapterVideoInput) {
    const parsed = LongReplaceChapterVideoInputSchema.parse(input);
    const opened = await this.catalog.open(parsed.bookId);
    return this.store.replaceChapterVideo(opened.projectDirectory, parsed);
  }
  async delete(input: LongDeleteChapterVideoInput) {
    const parsed = LongDeleteChapterVideoInputSchema.parse(input);
    const opened = await this.catalog.open(parsed.bookId);
    const result = await this.store.deleteChapterVideo(
      opened.projectDirectory,
      parsed
    );
    await this.catalog
      .updateSummary(parsed.bookId, result.document.summary)
      .catch(() => undefined);
    return result;
  }
}
