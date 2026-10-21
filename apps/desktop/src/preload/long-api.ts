import type { DeepWriteApi } from "@deepwrite/contracts";
import {
  getCharacterAppearanceReferences,
  prepareCharacterAppearanceDirectory,
  deleteCharacterAppearance
} from "./character-appearance-api";
import {
  readChapterImage,
  addChapterImage,
  replaceChapterImage,
  deleteChapterImage,
  copyChapterImage,
  copyChapterImagePath,
  readClipboardImage
} from "./chapter-images-api";
import {
  readChapterVideo,
  addChapterVideo,
  replaceChapterVideo,
  deleteChapterVideo,
  copyChapterVideo,
  copyChapterVideoPath
} from "./chapter-videos-api";
import {
  readCharacterProfile,
  saveCharacterProfile,
  importCharacterAssets,
  renameCharacterAsset,
  deleteCharacterAsset,
  copyCharacterAsset
} from "./character-assets-api";
import {
  listLongBooks,
  createLongBook,
  duplicateLongBook,
  updateLongBookBindings,
  renameLongBook,
  chooseLegacySyncSource,
  applyLegacySync,
  chooseContinuationImportSource,
  importContinuationLongBook,
  importPortableLongBook,
  openLongBook,
  openExistingLongBook,
  unregisterLongBook,
  deleteLongBook
} from "./long-book-api";
import {
  getLongWorkspaceIndex,
  readLongDocument,
  writeLongDocument,
  readLongAgentsMd,
  writeLongAgentsMd,
  previewLongOperations,
  applyLongOperations,
  writeLongChapter,
  commitLongChapter,
  deleteLongLedgerCommit,
  searchLongDocuments
} from "./long-document-api";
import { resolveLongConflicts } from "./long-recovery-api";
export const long: DeepWriteApi["long"] = {
  prepareCharacterAppearanceDirectory,
  addChapterImage,
  deleteCharacterAppearance,
  getCharacterAppearanceReferences,
  readChapterImage,
  replaceChapterImage,
  deleteChapterImage,
  copyChapterImage,
  copyChapterImagePath,
  readClipboardImage,
  readChapterVideo,
  addChapterVideo,
  replaceChapterVideo,
  deleteChapterVideo,
  copyChapterVideo,
  copyChapterVideoPath,
  readCharacterProfile,
  saveCharacterProfile,
  importCharacterAssets,
  renameCharacterAsset,
  deleteCharacterAsset,
  copyCharacterAsset,
  resolveConflicts: resolveLongConflicts,
  list: listLongBooks,
  create: createLongBook,
  duplicateBook: duplicateLongBook,
  rename: renameLongBook,
  updateBindings: updateLongBookBindings,
  chooseLegacySyncSource,
  applyLegacySync,
  importPortable: importPortableLongBook,
  chooseContinuationImportSource,
  importContinuation: importContinuationLongBook,
  open: openLongBook,
  openExisting: openExistingLongBook,
  getWorkspaceIndex: getLongWorkspaceIndex,
  readDocument: readLongDocument,
  search: searchLongDocuments,
  writeDocument: writeLongDocument,
  readAgentsMd: readLongAgentsMd,
  writeAgentsMd: writeLongAgentsMd,
  previewOperations: previewLongOperations,
  applyOperations: applyLongOperations,
  writeChapter: writeLongChapter,
  commitChapter: commitLongChapter,
  deleteLedgerCommit: deleteLongLedgerCommit,
  unregister: unregisterLongBook,
  delete: deleteLongBook
};
