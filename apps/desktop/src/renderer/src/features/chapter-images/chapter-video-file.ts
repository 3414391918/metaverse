import { LONG_CHAPTER_VIDEO_MAX_BYTES } from "@deepwrite/contracts";

export type ChapterVideoExtension = "mp4" | "webm";

export function chapterVideoExtension(file: File): ChapterVideoExtension {
  const extension = /\.(mp4|webm)$/iu.exec(file.name)?.[1]?.toLowerCase();
  if (extension !== "mp4" && extension !== "webm")
    throw new Error("请选择 MP4 或 WebM 视频文件。");
  if (file.size < 1 || file.size > LONG_CHAPTER_VIDEO_MAX_BYTES)
    throw new Error("视频大小必须在 100 MB 以内。");
  if (file.type && file.type !== `video/${extension}`)
    throw new Error("视频文件扩展名与格式不一致。");
  return extension;
}

export async function chapterVideoDataUrl(file: File): Promise<string> {
  const extension = chapterVideoExtension(file);
  const blob = new Blob([file], { type: `video/${extension}` });
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("视频文件读取失败。"));
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("视频文件读取失败。"));
    };
    reader.readAsDataURL(blob);
  });
}
