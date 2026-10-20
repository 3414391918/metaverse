import { longChapterImageDirectoryFromBodyPath } from "@deepwrite/contracts";

export function longChapterImageUrl(
  bookId: string,
  documentPath: string,
  source: string
): string | undefined {
  const chapter = longChapterImageDirectoryFromBodyPath(documentPath);
  const video = /^videos\/([\w.-]+\.(?:mp4|webm))$/i.exec(source)?.[1];
  if (chapter && video)
    return `deepwrite-image://book/${bookId}/${chapter}/videos/${video}`;
  const filename = /^images\/([\w.-]+\.(?:png|jpe?g|webp|gif|avif))$/i.exec(
    source
  )?.[1];
  if (!chapter || !filename) {
    return undefined;
  }
  return `deepwrite-image://book/${bookId}/${chapter}/${filename}`;
}
