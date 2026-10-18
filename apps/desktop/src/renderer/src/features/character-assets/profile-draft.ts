import type { LongCharacterProfile } from "@deepwrite/contracts";

export type ProfileField =
  | "name"
  | "keywords"
  | "faceDescription"
  | "settingDescription"
  | "appearance-name"
  | "appearance-description"
  | "appearance-create"
  | "all";
export const cloneProfile = (
  profile: LongCharacterProfile
): LongCharacterProfile => ({
  ...profile,
  appearances: profile.appearances.map((item) => ({ ...item }))
});

export function mergeProfileField(
  saved: LongCharacterProfile,
  draft: LongCharacterProfile,
  field: ProfileField,
  appearanceId?: string
): LongCharacterProfile {
  if (field === "all") return cloneProfile(draft);
  const result = cloneProfile(saved);
  if (field.startsWith("appearance-")) {
    const appearance = draft.appearances.find(
      (item) => item.id === appearanceId
    );
    if (!appearance) throw new Error("请选择形象。");
    const target = result.appearances.find((item) => item.id === appearanceId);
    if (field === "appearance-create") {
      if (!target) result.appearances.push({ ...appearance });
    } else {
      if (!target) throw new Error("请先保存新形象。");
      if (field === "appearance-name") target.name = appearance.name;
      else target.description = appearance.description;
    }
  } else {
    const key = field as
      "name" | "keywords" | "faceDescription" | "settingDescription";
    result[key] = draft[key];
  }
  return result;
}

export function rebaseProfileDraft(
  before: LongCharacterProfile,
  current: LongCharacterProfile,
  submitted: LongCharacterProfile,
  returned: LongCharacterProfile
): LongCharacterProfile {
  const next = cloneProfile(current);
  for (const key of [
    "name",
    "keywords",
    "faceDescription",
    "settingDescription"
  ] as const) {
    if (current[key] === before[key] || current[key] === submitted[key])
      next[key] = returned[key];
  }
  next.appearances = returned.appearances.map((saved) => {
    const draft = current.appearances.find((item) => item.id === saved.id);
    const old = before.appearances.find((item) => item.id === saved.id);
    const sent = submitted.appearances.find((item) => item.id === saved.id);
    return {
      ...saved,
      ...Object.fromEntries(
        (["name", "description"] as const).map((key) => [
          key,
          draft && draft[key] !== old?.[key] && draft[key] !== sent?.[key]
            ? draft[key]
            : saved[key]
        ])
      )
    };
  });
  next.appearances.push(
    ...current.appearances
      .filter(
        (item) => !returned.appearances.some((saved) => saved.id === item.id)
      )
      .map((item) => ({ ...item }))
  );
  return next;
}
