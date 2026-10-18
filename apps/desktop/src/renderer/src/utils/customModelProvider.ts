export const CUSTOM_PROVIDER_NAME_MAX = 120;
export const OTHER_COMPAT_PROVIDER = "custom";

export interface ProviderSelectOption {
  value: string;
  label: string;
  description?: string;
}

export function normalizeProviderId(name: string): string {
  return name.trim().toLowerCase();
}

export function builtinProviderSets(options: readonly ProviderSelectOption[]): {
  values: Set<string>;
  labels: Set<string>;
} {
  const values = new Set<string>();
  const labels = new Set<string>();
  for (const option of options) {
    values.add(normalizeProviderId(option.value));
    labels.add(normalizeProviderId(option.label));
  }
  return { values, labels };
}

export function collectUserProviderIds(
  providers: readonly string[],
  builtinValues: ReadonlySet<string>
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const raw of providers) {
    const id = normalizeProviderId(raw);
    if (!id || builtinValues.has(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function mergeProviderSelectOptions(
  builtin: readonly ProviderSelectOption[],
  userIds: readonly string[]
): ProviderSelectOption[] {
  const builtinValues = new Set(
    builtin.map((option) => normalizeProviderId(option.value))
  );
  const named = builtin.filter(
    (option) => option.value !== OTHER_COMPAT_PROVIDER
  );
  const other = builtin.find(
    (option) => option.value === OTHER_COMPAT_PROVIDER
  );
  const users: ProviderSelectOption[] = [];
  const seen = new Set<string>();
  for (const raw of userIds) {
    const id = normalizeProviderId(raw);
    if (!id || builtinValues.has(id) || seen.has(id)) continue;
    seen.add(id);
    users.push({ value: id, label: id });
  }
  return other ? [...named, ...users, other] : [...named, ...users];
}

export type ResolveCustomProviderResult =
  { status: "invalid"; message: string } | { status: "ok"; provider: string };

export function resolveCustomProviderName(
  name: string,
  builtin: readonly ProviderSelectOption[]
): ResolveCustomProviderResult {
  const provider = normalizeProviderId(name);
  if (!provider) {
    return { status: "invalid", message: "请输入提供商名称" };
  }
  if (provider.length > CUSTOM_PROVIDER_NAME_MAX) {
    return {
      status: "invalid",
      message: "提供商名称不能超过 120 个字符"
    };
  }
  const { values, labels } = builtinProviderSets(builtin);
  if (values.has(provider) || labels.has(provider)) {
    return {
      status: "invalid",
      message: "这是内置提供商，请直接从列表选择"
    };
  }
  return { status: "ok", provider };
}
