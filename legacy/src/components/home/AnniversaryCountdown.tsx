"use client";

import Link from "next/link";
import type { DashboardData } from "@/types";

interface AnniversaryCountdownProps {
  dashboard: DashboardData | null;
}

export function AnniversaryCountdown({ dashboard }: AnniversaryCountdownProps) {
  if (!dashboard?.anniversary_date) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 12 }}>
        <Link href="/mine" className="preview-link">
          设置纪念日
        </Link>
      </div>
    );
  }

  const start = new Date(dashboard.anniversary_date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="card centered anniversary-card">
      <div className="card-muted anniversary-caption">我们在一起已经</div>
      <div className="anniversary-value">
        {diff} <span className="anniversary-unit">天</span>
      </div>
    </div>
  );
}
