import {
  LongCharacterProfileSchema,
  type LongCharacterProfile
} from "./long-character-profile";

const outfitBody =
  /^(?:[（(]\d+[）)]\s*)?(?:发型描述|服装描述|穿搭描述|服装给[^\r\n：:]{0,80})[：:]/u;

/** Only explicit legacy labels are extracted. Unknown paragraphs retain their original text and separators. */
export function parseLegacyLongCharacterProfileMarkdown(
  content: string,
  name: string,
  aliases: readonly string[]
): LongCharacterProfile {
  let faceDescription = "";
  const appearances: LongCharacterProfile["appearances"] = [];
  const kept: string[] = [];
  let active: LongCharacterProfile["appearances"][number] | undefined;
  const chunks = content.split(/((?:\r?\n){2,})/u);
  for (let i = 0; i < chunks.length; i += 2) {
    const paragraph = chunks[i]!;
    const separator = chunks[i + 1] ?? "";
    const text = paragraph.replace(/\r?\n$/u, "");
    const face =
      /^(?:脸部身材描述|脸部描述|面部描述|外貌描述)[：:]\s*([\s\S]+)$/u.exec(
        text
      );
    const inline =
      /^(\d+)[.、．]\s*(?:服装|形象|穿搭)[：:]\s*([^\r\n]+)$/u.exec(text);
    const heading =
      /^(\d+)[.、．]\s*([^\r\n]{1,256}(?:服装|形象|穿搭))\r?\n/u.exec(text);
    if (face && !faceDescription) {
      faceDescription = face[1]!;
      active = undefined;
    } else if (inline) {
      active = {
        id: `appearance_legacy_${appearances.length + 1}`,
        name: `服装 ${inline[1]}`,
        description: inline[2]!
      };
      appearances.push(active);
    } else if (heading && outfitBody.test(text.slice(heading[0].length))) {
      active = {
        id: `appearance_legacy_${appearances.length + 1}`,
        name: heading[2]!,
        description: text.slice(heading[0].length)
      };
      appearances.push(active);
    } else if (active && outfitBody.test(text)) {
      active.description += `\n\n${text}`;
    } else {
      kept.push(paragraph + separator);
      active = undefined;
    }
  }
  return LongCharacterProfileSchema.parse({
    name,
    keywords: aliases.join("、"),
    faceDescription,
    settingDescription: kept.join(""),
    appearances
  });
}
