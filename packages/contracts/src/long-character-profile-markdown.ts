import {
  LongCharacterProfileSchema,
  type LongCharacterProfile
} from "./long-character-profile";
import { parseLegacyLongCharacterProfileMarkdown } from "./long-character-profile-legacy";

export const LONG_CHARACTER_PROFILE_HEADER =
  "<!-- deepwrite:character-profile:v1 -->";
const marker = (field: string) => `<!-- deepwrite:${field} -->`;
const section = (field: string, value: string) =>
  `${marker(field)}\n${value}\n${marker(`end-${field}`)}`;

export function serializeLongCharacterProfileMarkdown(
  raw: LongCharacterProfile
): string {
  const profile = LongCharacterProfileSchema.parse(raw);
  return [
    LONG_CHARACTER_PROFILE_HEADER,
    section("keywords", profile.keywords),
    section("face", profile.faceDescription),
    section("setting", profile.settingDescription),
    ...profile.appearances.map((appearance) =>
      section(
        `appearance:${appearance.id}`,
        `## ${appearance.name}\n${appearance.description}`
      )
    ),
    marker("end-character-profile"),
    ""
  ].join("\n");
}

export function isStructuredLongCharacterProfileMarkdown(
  content: string
): boolean {
  return content.includes("<!-- deepwrite:");
}

export function parseLongCharacterProfileMarkdown(
  content: string,
  name: string,
  aliases: readonly string[] = []
): LongCharacterProfile {
  if (!isStructuredLongCharacterProfileMarkdown(content)) {
    return parseLegacyLongCharacterProfileMarkdown(content, name, aliases);
  }
  try {
    let rest = content;
    const consume = (prefix: string) => {
      if (!rest.startsWith(prefix)) throw new Error();
      rest = rest.slice(prefix.length);
    };
    const field = (id: string) => {
      consume(`${marker(id)}\n`);
      const end = `\n${marker(`end-${id}`)}\n`;
      const offset = rest.indexOf(end);
      if (offset < 0) throw new Error();
      const value = rest.slice(0, offset);
      rest = rest.slice(offset + end.length);
      return value;
    };
    consume(`${LONG_CHARACTER_PROFILE_HEADER}\n`);
    const keywords = field("keywords");
    const faceDescription = field("face");
    const settingDescription = field("setting");
    const appearances: LongCharacterProfile["appearances"] = [];
    while (rest.startsWith("<!-- deepwrite:appearance:")) {
      const match =
        /^<!-- deepwrite:appearance:([A-Za-z0-9][A-Za-z0-9_-]{0,159}) -->\n/u.exec(
          rest
        );
      if (!match) throw new Error();
      const id = match[1]!;
      const value = field(`appearance:${id}`);
      const heading = /^## ([^\r\n]+)\n/u.exec(value);
      if (!heading) throw new Error();
      appearances.push({
        id,
        name: heading[1]!,
        description: value.slice(heading[0].length)
      });
    }
    consume(`${marker("end-character-profile")}\n`);
    if (rest !== "") throw new Error();
    return LongCharacterProfileSchema.parse({
      name,
      keywords,
      faceDescription,
      settingDescription,
      appearances
    });
  } catch {
    throw new Error("角色核心档案结构损坏：请保留完整分区与形象标识。");
  }
}
