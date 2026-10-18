import { effectScope, reactive } from "vue";
import { describe, expect, it } from "vitest";
import type {
  MaterialLibrary,
  MaterialLibraryGroup,
  SkillLibrary,
  SkillLibraryGroup
} from "@deepwrite/contracts";
import {
  useBookLibrarySelection,
  type BookLibrarySelectionProps
} from "./useBookLibrarySelection";
function properties(): BookLibrarySelectionProps {
  return {
    workspaceType: "long",
    materials: [
      {
        id: "material_1",
        title: "人物素材",
        materialKind: "character",
        materialType: "script",
        parentGenre: "",
        subGenre: ""
      } as MaterialLibrary
    ],
    skills: [
      {
        id: "skill_1",
        title: "文风技能",
        skillKind: "style",
        skillType: "long"
      } as SkillLibrary
    ],
    materialGroups: [
      {
        id: "material_group",
        title: "素材分组",
        members: { character: "material_1" }
      } as MaterialLibraryGroup
    ],
    skillGroups: [
      {
        id: "skill_group",
        title: "技能分组",
        members: { style: "skill_1" }
      } as SkillLibraryGroup
    ]
  };
}
describe("shared book library selection", () => {
  it("resolves groups to independent ID snapshots from the shared cross-workspace library pool", () => {
    const scope = effectScope();
    const props = reactive(properties());
    try {
      const selection = scope.run(() => useBookLibrarySelection(props))!;
      selection.materialBindingMode.value = "group";
      selection.selectedMaterialGroupId.value = "material_group";
      selection.skillBindingMode.value = "group";
      selection.selectedSkillGroupId.value = "skill_group";
      const materials = selection.selectedMaterialLinks();
      const skills = selection.selectedSkillLinks();
      expect(materials.character).toEqual(["material_1"]);
      expect(skills.style).toEqual(["skill_1"]);
      props.materialGroups[0]!.members.character = "";
      props.skillGroups[0]!.members.style = "";
      expect(materials.character).toEqual(["material_1"]);
      expect(skills.style).toEqual(["skill_1"]);
    } finally {
      scope.stop();
    }
  });
});
