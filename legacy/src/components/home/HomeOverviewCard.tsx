"use client";

import Link from "next/link";
import type { DashboardData } from "@/types";

interface HomeOverviewCardProps {
  dashboard: DashboardData | null;
}

export function HomeOverviewCard({ dashboard }: HomeOverviewCardProps) {
  return (
    <div className="card card-hero">
      <div className="card-hero-media">
        <img src="/couple-points/background.webp" alt="background" />
      </div>

      <div className="card-hero-overlay" />

      <div className="card-hero-top">
        <div className="card-hero-label">当前积分</div>
        <div className="card-hero-balance">{dashboard?.balance ?? 0}</div>
      </div>

      <div className="card-hero-bottom">
        <div>
          <div className="card-hero-stat-label">今日打卡</div>
          <div className="card-hero-stat-value">
            {dashboard?.done_daily ?? 0}
            <span className="card-hero-stat-total">/ {dashboard?.total_rules_daily ?? 0}</span>
          </div>
        </div>

        <Link href="/checkin" className="btn card-hero-action">
          去打卡
        </Link>
      </div>
    </div>
  );
}
