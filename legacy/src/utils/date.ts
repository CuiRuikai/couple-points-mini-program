const BEIJING_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toBeijingISODate(value: Date) {
  const parts = BEIJING_DATE_FORMATTER.formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function toISODate(value: Date) {
  return toBeijingISODate(value);
}

export function formatDate(value: string | Date | number) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string | Date | number) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function clampDateWithinDays(date: Date, days: number) {
  const now = new Date();
  const earliest = new Date(now);
  earliest.setDate(now.getDate() - days);
  const targetDate = toISODate(date);
  const earliestDate = toISODate(earliest);
  const today = toISODate(now);
  return targetDate >= earliestDate && targetDate <= today;
}
