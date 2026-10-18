import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useCreativeBookCreation } from "./useCreativeBookCreation";

describe("novel creation", () => {
  it("creates the current novel format directly and snapshots reactive library bindings", async () => {
    const bindings = ref({
      linkedMaterialIdsByKind: {
        character: ["material_1"],
        gimmick: [],
        plot: [],
        draft: [],
        other: []
      },
      linkedSkillIdsByKind: {
        general: ["skill_1"],
        plot: [],
        style: [],
        other: []
      }
    });
    const createLong = vi.fn(async (payload: unknown) => {
      structuredClone(payload);
    });
    const flow = useCreativeBookCreation({
      open: ref(true),
      pending: () => false,
      createLong
    });
    await flow.createCreativeBook({
      title: "新书",
      genre: "其他",
      ...bindings.value
    });
    expect(createLong).toHaveBeenCalledExactlyOnceWith({
      title: "新书",
      genre: "其他",
      ...bindings.value
    });
    bindings.value.linkedSkillIdsByKind.general.push("skill_later");
    expect(createLong.mock.calls[0]![0]).toMatchObject({
      linkedSkillIdsByKind: { general: ["skill_1"] }
    });
  });
});
