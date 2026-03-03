export const QUICK_SCORE_OPTION_OTHER = "其他";

export const DEFAULT_QUICK_SCORE_OPTIONS = {
  plus: ["家务", "听话", "主动沟通", "照顾对方", QUICK_SCORE_OPTION_OTHER],
  minus: ["不做家务", "沟通不当", "迟到爽约", "态度不好", QUICK_SCORE_OPTION_OTHER],
} as const;

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export function normalizeQuickScoreOptions(value: unknown, fallback: readonly string[]) {
  const cleaned = toStringArray(value);
  const merged = cleaned.length > 0 ? cleaned : [...fallback];
  if (!merged.includes(QUICK_SCORE_OPTION_OTHER)) {
    merged.push(QUICK_SCORE_OPTION_OTHER);
  }
  return Array.from(new Set(merged)).slice(0, 12);
}

export function optionsToText(value: string[]) {
  return value.join("\n");
}

export function parseOptionsText(value: string) {
  const items = value
    .split(/\r?\n|,|，/)
    .map((item) => item.trim())
    .filter(Boolean);
  return normalizeQuickScoreOptions(items, [QUICK_SCORE_OPTION_OTHER]);
}
