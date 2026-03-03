"use client";

import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { formatPoints, formatTxnTypeNote } from "@/utils/format";
import { useDashboard } from "@/hooks/useDashboard";
import { AnniversaryCountdown } from "@/components/home/AnniversaryCountdown";
import { HomeOverviewCard } from "@/components/home/HomeOverviewCard";
import { HomeQuickScoreCard } from "@/components/home/HomeQuickScoreCard";

function toSortTimestamp(value: string | number | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
}

export default function HomePage() {
  const { dashboard, loading, refresh } = useDashboard();
  const recentTransactions = (dashboard?.recent_transactions ?? [])
    .slice()
    .sort((a, b) => {
      if (a.event_date !== b.event_date) {
        return b.event_date.localeCompare(a.event_date);
      }
      return toSortTimestamp(b.created_at) - toSortTimestamp(a.created_at);
    })
    .slice(0, 5);

  return (
    <div>
      <TopBar title="首页" />
      <div className="page">
        <div className="grid">
          <AnniversaryCountdown dashboard={dashboard} />
          <HomeOverviewCard dashboard={dashboard} />
        </div>
        <HomeQuickScoreCard onRefresh={refresh} />

        {/* Simple Flow (Last 5) */}
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-header">
            <div className="section-title">最新动态</div>
            <Link href="/statistics" className="preview-link">
              更多
            </Link>
          </div>
          <div className="list" style={{ marginTop: 12 }}>
            {recentTransactions.map((item) => (
              <div key={item._id} className="list-item">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{item.title}</strong>
                  <span>{formatPoints(item.points_final ?? item.points_suggested)}</span>
                </div>
                <div className="card-muted">
                  {formatTxnTypeNote(item.type, item.note)}
                </div>
              </div>
            ))}
            {loading && !dashboard ? <div className="card-muted">加载中…</div> : null}
            {!loading && recentTransactions.length === 0 ? <div className="card-muted">暂无动态</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
