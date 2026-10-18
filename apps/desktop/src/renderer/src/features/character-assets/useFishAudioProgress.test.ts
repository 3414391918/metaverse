import { describe, expect, it } from "vitest";
import { useFishAudioProgress } from "./useFishAudioProgress";

describe("useFishAudioProgress", () => {
  it("tracks platform steps while ignoring unrelated operations", () => {
    const progress = useFishAudioProgress();
    progress.start("prepare", "准备音频资料");
    progress.complete("prepare", "已选择 1 段音频");
    progress.acceptPlatform("operation-1", {
      operationId: "operation-2",
      stage: "voice.create",
      status: "running"
    });
    expect(progress.nodes.value).toHaveLength(1);
    progress.acceptPlatform("operation-1", {
      operationId: "operation-1",
      stage: "voice.create",
      status: "running"
    });
    progress.acceptPlatform("operation-1", {
      operationId: "operation-1",
      stage: "voice.create",
      status: "completed",
      detail: "声音 ID：test"
    });
    expect(progress.nodes.value).toEqual([
      expect.objectContaining({
        status: "completed",
        detail: "已选择 1 段音频"
      }),
      expect.objectContaining({ status: "completed", detail: "声音 ID：test" })
    ]);
  });

  it("keeps the failed step and its actionable error visible", () => {
    const progress = useFishAudioProgress();
    progress.start("voice.create", "创建声音");
    progress.fail(new Error("音频格式不受支持"));
    expect(progress.nodes.value[0]).toMatchObject({
      status: "error",
      detail: "音频格式不受支持"
    });
  });

  it("marks the active step cancelled", () => {
    const progress = useFishAudioProgress();
    progress.start("voice.create", "创建声音");
    progress.cancel();
    expect(progress.nodes.value[0]).toMatchObject({
      status: "cancelled",
      detail: "任务已取消"
    });
  });
});
