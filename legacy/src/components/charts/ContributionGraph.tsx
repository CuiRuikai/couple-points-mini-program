"use client";
import { useMemo, useRef, useState, useEffect } from "react";
import { toISODate } from "@/utils/date";

interface ContributionGraphProps {
  data: { _id: string; count: number }[]; // _id is date YYYY-MM-DD
}

export function ContributionGraph({ data }: ContributionGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState({ cols: 20, gap: 3 });

  useEffect(() => {
    if (!containerRef.current) return;

    const updateConfig = () => {
      const width = containerRef.current?.offsetWidth || 0;
      if (width > 0) {
        // Cell size is fixed at 10px
        const cellSize = 10;
        // Minimum gap we want is 2px
        const minGap = 2;

        // width = cols * cellSize + (cols - 1) * gap
        // Try to find max cols that fit with minGap
        // width = cols * 10 + cols * 2 - 2 = 12 * cols - 2
        // cols = (width + 2) / 12
        const rawCols = Math.floor((width + minGap) / (cellSize + minGap));
        // Clamp to a reasonable max (e.g. 52 weeks)
        const cols = Math.min(rawCols, 53);

        // Now calculate the exact gap to fill the width
        // gap = (width - cols * cellSize) / (cols - 1)
        let gap = 3;
        if (cols > 1) {
          gap = (width - cols * cellSize) / (cols - 1);
        }

        setConfig({ cols, gap });
      }
    };

    updateConfig();
    const observer = new ResizeObserver(updateConfig);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  const days = useMemo(() => {
    const today = new Date();
    const result = [];
    const totalDays = config.cols * 7;

    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      result.push(toISODate(d));
    }
    return result;
  }, [config.cols]);

  const getColor = (count: number) => {
    if (!count) return "var(--heatmap-empty)";
    if (count === 1) return "var(--heatmap-level-1)";
    if (count === 2) return "var(--heatmap-level-2)";
    if (count === 3) return "var(--heatmap-level-3)";
    return "var(--heatmap-level-4)";
  };

  const dataMap = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((d) => (map[d._id] = d.count));
    return map;
  }, [data]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "grid",
        gridTemplateRows: "repeat(7, 10px)",
        gridAutoFlow: "column",
        gap: config.gap,
        paddingBottom: 4,
        maxWidth: "100%",
        // Force full justification
        justifyContent: "space-between",
      }}
    >
      {days.map((date) => (
        <div
          key={date}
          title={`${date}: ${dataMap[date] || 0}`}
          style={{
            width: 10,
            height: 10,
            backgroundColor: getColor(dataMap[date] || 0),
            borderRadius: 2,
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}
