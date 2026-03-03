"use client";
import { useMemo } from "react";
import { toISODate } from "@/utils/date";

interface RuleHeatmapProps {
  checkins: string[]; // List of YYYY-MM-DD strings
  days?: number;
}

export function RuleHeatmap({ checkins, days = 14 }: RuleHeatmapProps) {
  const dates = useMemo(() => {
    const result = [];
    const today = new Date();
    // Generate dates in reverse order (past -> today)
    // Actually, usually heatmaps go left-to-right (past -> today)
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      result.push(toISODate(d));
    }
    return result;
  }, [days]);

  const checkinSet = useMemo(() => new Set(checkins), [checkins]);

  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {dates.map((date) => {
        const isDone = checkinSet.has(date);
        return (
          <div
            key={date}
            title={`${date}: ${isDone ? "已打卡" : "未打卡"}`}
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: isDone ? "var(--heatmap-level-3)" : "var(--heatmap-empty)",
              opacity: 1,
            }}
          />
        );
      })}
    </div>
  );
}
