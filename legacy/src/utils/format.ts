export function formatPoints(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return value > 0 ? `+${value}` : `${value}`;
}

export function formatTxnType(type?: string | null) {
  if (!type) return "";
  const map: Record<string, string> = {
    checkin: "打卡",
    special: "特殊事件",
    redemption: "兑换",
    adjust: "调整",
  };
  return map[type] ?? type;
}

export function formatTxnTypeNote(type?: string | null, note?: string | null) {
  const typeText = formatTxnType(type);
  const noteText = typeof note === "string" ? note.trim() : "";
  if (!noteText) return typeText;
  return `${typeText} - ${noteText}`;
}
