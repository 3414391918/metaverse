import type { WorkspaceDocument } from "../types/workspace";

export function catalogNodeId(...parts: string[]): string {
  return ["catalog", ...parts.map((part) => encodeURIComponent(part))].join(
    ":"
  );
}

export function indexedContentBytes(
  value: object,
  field: "contentBytes" | "overviewContentBytes" = "contentBytes"
): number | undefined {
  const candidate = (value as Record<string, unknown>)[field];
  return typeof candidate === "number" && Number.isSafeInteger(candidate)
    ? candidate
    : undefined;
}

export function indexedContentStamp(
  value: object,
  field: "contentStamp" | "overviewContentStamp" = "contentStamp"
): string | undefined {
  const candidate = (value as Record<string, unknown>)[field];
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : undefined;
}

export function catalogContentState(
  value: object,
  field: "contentBytes" | "overviewContentBytes" = "contentBytes"
): Pick<
  WorkspaceDocument,
  "catalogContentBytes" | "catalogContentStamp" | "catalogContentLoaded"
> {
  const contentBytes = indexedContentBytes(value, field);
  const contentStamp = indexedContentStamp(
    value,
    field === "overviewContentBytes" ? "overviewContentStamp" : "contentStamp"
  );
  return contentBytes === undefined
    ? { catalogContentLoaded: true }
    : {
        catalogContentBytes: contentBytes,
        ...(contentStamp ? { catalogContentStamp: contentStamp } : {}),
        catalogContentLoaded: false
      };
}

export function catalogContentPresent(
  value: object,
  content: string,
  field: "contentBytes" | "overviewContentBytes" = "contentBytes"
): boolean {
  const contentBytes = indexedContentBytes(value, field);
  return contentBytes === undefined
    ? content.trim().length > 0
    : contentBytes > 0;
}

export function materialEntryDocumentId(
  libraryId: string,
  entryId: string
): string {
  return catalogNodeId("material-entry", libraryId, entryId);
}

export function materialOverviewDocumentId(libraryId: string): string {
  return catalogNodeId("material-overview", libraryId);
}

export function skillEntryDocumentId(
  libraryId: string,
  entryId: string
): string {
  return catalogNodeId("skill-entry", libraryId, entryId);
}

export function skillOverviewDocumentId(libraryId: string): string {
  return catalogNodeId("skill-overview", libraryId);
}
