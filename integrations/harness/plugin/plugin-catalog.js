/** Project Harness records into one list without duplicating bundle-owned entries. */
const profileBundles = new Set([
  "@deepseek-ai/dsh-base",
  "@deepseek-ai/dsh-web-app",
  "@deepseek-ai/dsh-headless",
  "@deepseek-ai/dsh-sdk-app",
  "@deepseek-ai/dsh-acp-app",
  "@deepseek-ai/dsh-sdk-minimal"
]);
export function localized(value, locale = "zh") {
  return typeof value === "string"
    ? value
    : value?.[locale] || value?.zh || value?.en || "";
}
export function pluginTitle(value, locale) {
  return (
    localized(value.meta?.title, locale) ||
    (value.entryId?.endsWith(":metaverse-integration")
      ? "元宇宙集成"
      : (value.name || value.moduleName || "")
          .split("/")
          .pop()
          .replace(/^dsh-(?:bundle-)?/, ""))
  );
}
export function collectPlugins({
  packages = [],
  plugins = [],
  inventory = {},
  locale = "zh"
}) {
  const bundles = packages.filter(
    (pkg) =>
      !profileBundles.has(pkg.name) &&
      (pkg.installed || pkg.official || pkg.error)
  );
  const owned = new Set(
    bundles.flatMap((pkg) => pkg.rows.map((row) => row.entryId).filter(Boolean))
  );
  const cards = [
    ...bundles.map((pkg) => ({
      ...pkg,
      key: `bundle:${pkg.name}`,
      kind: "bundle",
      title: pluginTitle(pkg, locale),
      description:
        localized(pkg.meta?.description, locale) || pkg.description || "",
      presets: []
    })),
    ...plugins
      .filter((plugin) => !owned.has(plugin.entryId))
      .map((plugin) => ({
        ...plugin,
        readOnlyReason: plugin.entryId?.endsWith(":metaverse-integration")
          ? "management-required"
          : plugin.readOnlyReason,
        key: `plugin:${plugin.entryId}`,
        kind: "plugin",
        title: pluginTitle(plugin, locale),
        description: localized(plugin.meta?.description, locale),
        presets: []
      }))
  ];
  for (const preset of inventory.agentPresets || []) {
    for (const row of preset.rows) {
      const name = preset.name || localized(preset.title, locale) || preset.id;
      let matches = cards.filter(
        (card) =>
          card.moduleName === row.moduleName ||
          card.rows?.some((part) => part.moduleName === row.moduleName)
      );
      if (!matches.length) {
        const card = {
          ...row,
          key: `preset:${row.moduleName}`,
          kind: "preset",
          enabled: row.fiberPhase === "active",
          readOnlyReason: "preset-composition",
          title: pluginTitle(row, locale),
          description: localized(row.meta?.description, locale),
          presets: []
        };
        cards.push(card);
        matches = [card];
      }
      for (const card of matches)
        if (!card.presets.includes(name)) card.presets.push(name);
    }
  }
  return cards;
}
export function pluginToggleTarget(card) {
  if (card.readOnlyReason) return undefined;
  if (card.kind === "bundle") return { kind: "bundle", id: card.name };
  if (card.kind === "plugin" && card.entryId)
    return { kind: "plugin", id: card.entryId };
  return undefined;
}
export function collectPluginConfigurations({
  ledger,
  packages = [],
  locale = "zh"
}) {
  const cards = ledger.items.map((item) => ({
    key: `item:${item.id}`,
    title: item.label,
    view: { kind: "item", id: item.id },
    id: item.id
  }));
  for (const name of ledger.bundles) {
    const pkg = packages.find((item) => item.name === name);
    if (pkg)
      cards.push({
        key: `bundle:${name}`,
        title: pluginTitle(pkg, locale),
        description:
          localized(pkg.meta?.description, locale) || pkg.description,
        meta: pkg.meta,
        view: { kind: "package", name }
      });
  }
  for (const key of ledger.rows) {
    for (const pkg of packages)
      for (const row of pkg.rows) {
        if (key === `${pkg.name}#${row.rowId}`)
          cards.push({
            key: `row:${key}`,
            title: pluginTitle(row, locale),
            description: localized(row.meta?.description, locale),
            meta: row.meta,
            view: { kind: "row", name: pkg.name, rowId: row.rowId }
          });
      }
  }
  return cards;
}
