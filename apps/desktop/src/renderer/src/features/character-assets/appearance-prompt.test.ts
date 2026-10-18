import { expect, it } from "vitest";
import { buildCharacterAppearancePrompt } from "./appearance-prompt";

const input = {
  mode: "make" as const,
  targetName: "林岚",
  faceDescription: "成年人物，深色眼睛，身材修长。",
  appearance: { id: "appearance_new", name: "雨夜", description: "" },
  target: {
    coreProfilePath: "/tmp/example-book/target/core-profile.md",
    assetsManifestPath: "/tmp/example-book/target/assets.json",
    assetsDirectory: "/tmp/example-book/target/assets"
  },
  reference: {
    characterId: "character_other",
    name: "白芷",
    assetsDirectory: "/tmp/example-book/source/assets",
    assetsManifestPath: "/tmp/example-book/source/assets.json"
  },
  referenceAppearance: {
    id: "appearance_template",
    name: "常服",
    assets: [
      { label: "面部上半身多角度", filename: `${"a".repeat(32)}.png` },
      { label: "全身多角度", filename: `${"b".repeat(32)}.png` }
    ]
  }
};

it("describes making a new target appearance using only the chosen template assets", () => {
  const prompt = buildCharacterAppearancePrompt(input);
  expect(prompt).toContain("形象制作");
  expect(prompt).toContain(input.faceDescription);
  expect(prompt).toContain("图片标签、动作、角度、构图及图片组织方式");
  expect(prompt).toContain("面部上半身多角度");
  expect(prompt).toContain(
    `/tmp/example-book/source/assets/${"a".repeat(32)}.png`
  );
  expect(prompt).toContain("共 2 张");
  expect(prompt).toContain("三、用户上传的参考形象");
  expect(prompt).toContain("特殊说明");
  expect(prompt).toContain("100 字");
  expect(prompt).toContain("1000 字");
  expect(prompt).toContain("不要采用用户上传参考图中的脸部");
});

it("preserves pose, camera and expression in replacement without adopting an uploaded face", () => {
  const prompt = buildCharacterAppearancePrompt({ ...input, mode: "replace" });
  expect(prompt).toContain("形象替换");
  expect(prompt).toContain("动作、角度、表情、镜头和构图保持不变");
  expect(prompt).toContain("不要采用用户上传参考图中的脸部");
  expect(prompt).toContain("只有用户明确要求替换发型时才修改发型");
  expect(prompt).toContain("目标角色");
});

it("includes exact new-appearance markers and append-only asset persistence instructions", () => {
  const prompt = buildCharacterAppearancePrompt(input);
  expect(prompt).toContain(input.target.coreProfilePath);
  expect(prompt).toContain(input.target.assetsManifestPath);
  expect(prompt).toContain(input.target.assetsDirectory);
  expect(prompt).toContain("<!-- deepwrite:appearance:appearance_new -->");
  expect(prompt).toContain("<!-- deepwrite:end-appearance:appearance_new -->");
  expect(prompt).toContain('"appearanceId": "appearance_new"');
  expect(prompt).toContain("追加");
  expect(prompt).toContain("32 位小写十六进制");
  expect(prompt).toContain("保留所有原有记录");
  expect(prompt).toContain("重新读取");
});

it("uses the selected reference subdirectory and a separate new output directory", () => {
  const referenceAppearance = {
    ...input.referenceAppearance,
    assetsDirectory: input.reference.assetsDirectory + "/appearance_template",
    assets: input.referenceAppearance.assets.map((asset) => ({
      ...asset,
      directory: "appearance_template"
    }))
  };
  const prompt = buildCharacterAppearancePrompt({
    ...input,
    referenceAppearance
  });
  expect(prompt).toContain(
    `角色资产绝对路径：${referenceAppearance.assetsDirectory}`
  );
  expect(prompt).toContain(
    `${referenceAppearance.assetsDirectory}/${"a".repeat(32)}.png`
  );
  expect(prompt).toContain(
    `新图片保存目录的绝对路径：${input.target.assetsDirectory}/appearance_new`
  );
  expect(prompt).toContain('"directory": "appearance_new"');
  expect(prompt).toContain("先创建上面指定的新形象图片目录");
  expect(prompt).not.toContain(
    `${input.reference.assetsDirectory}/${"a".repeat(32)}.png`
  );
});
