"use client";

import { useState, useEffect, useMemo } from "react";
import { TopBar } from "@/components/layout/TopBar";
import LedgerView from "./LedgerView";
import ExchangeView from "./ExchangeView";
import { ContributionGraph } from "@/components/charts/ContributionGraph";
import { RuleHeatmap } from "@/components/charts/RuleHeatmap";
import { useCouple } from "@/providers/CoupleProvider";
import { useAuth } from "@/providers/AuthProvider";
import { callFunction } from "@/lib/cloudbase";
import { useToast } from "@/providers/ToastProvider";
import { toISODate } from "@/utils/date";
import { CacheUtils } from "@/utils/cache";

export default function StatisticsPage() {
  const { user } = useAuth();
  const { coupleId } = useCouple();
  const { pushToast } = useToast();
  const [tab, setTab] = useState<"flow" | "exchange">("flow");

  const [stats, setStats] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [recentCheckins, setRecentCheckins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!coupleId || !user) return;
      setLoading(true);
      try {
        // 1. Fetch Global Stats (Yearly) with Cache
        // Using v6 cache key to force fresh data load after data-shape fix
        const statsCacheKey = `checkin_stats_year_v6_${coupleId}`;
        let statsData = CacheUtils.get<any[]>(statsCacheKey);

        if (!statsData) {
          const end = toISODate(new Date());
          const startD = new Date();
          startD.setDate(startD.getDate() - 365);
          const start = toISODate(startD);

          const res = await callFunction<any[]>("get_data", {
            type: "checkin_stats",
            uid: user.uid,
            params: { start_date: start, end_date: end },
          });
          statsData = Array.isArray(res) ? res : [];
          // Reduced cache time from 3600s (1h) to 60s (10m) to better sync with recent checkins
          CacheUtils.set(statsCacheKey, statsData, 600);
        }
        setStats(statsData || []);

        // 2. Fetch Active Rules with Cache
        const rulesCacheKey = `rules_list_${coupleId}`;
        let rulesData = CacheUtils.get<any[]>(rulesCacheKey);

        if (!rulesData) {
          const rulesRes = await callFunction("get_rules", { uid: user.uid });
          rulesData = rulesRes?.rules || [];
          CacheUtils.set(rulesCacheKey, rulesData, 600);
        }

        const activeRules = (rulesData || []).filter((r: any) => r.active);
        setRules(activeRules);

        // 3. Fetch Recent Checkins (Last 14 days) for per-rule heatmaps
        const recentCacheKey = `checkin_recent_14d_v5_${coupleId}`;
        let checkinsData = CacheUtils.get<any[]>(recentCacheKey);

        if (!checkinsData) {
          const recentStartD = new Date();
          recentStartD.setDate(recentStartD.getDate() - 14);
          const recentStart = toISODate(recentStartD);
          const recentEnd = toISODate(new Date());
          // Use cloud function query to avoid direct database ACL limitations.
          const checkinsRes = await callFunction<any[]>("get_data", {
            type: "recent_checkins",
            uid: user.uid,
            params: {
              start_date: recentStart,
              end_date: recentEnd,
            },
          });

          checkinsData = Array.isArray(checkinsRes) ? checkinsRes : [];
          CacheUtils.set(recentCacheKey, checkinsData, 300); // Cache for 5 minutes
        }

        setRecentCheckins(checkinsData || []);
      } catch (e) {
        const message = e instanceof Error ? e.message : "加载统计数据失败";
        pushToast(message || "加载统计数据失败", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [coupleId, pushToast, user]);

  const getRuleCheckins = (ruleId: string) => {
    return recentCheckins
      .filter((c) => c.rule_id === ruleId)
      .map((c) => c.event_date);
  };

  const totalCheckins = useMemo(() => {
    return stats.reduce((acc, curr) => acc + (curr.count || 0), 0);
  }, [stats]);

  return (
    <div>
      <TopBar title="统计" />
      <div className="page">
        {/* Section 1: Total Heatmap */}
        <div className="card" style={{ marginBottom: 16, overflow: "hidden" }}>
          <div className="card-title">过去一年 {totalCheckins} 次打卡</div>
          {/* ContributionGraph handles its own width and alignment */}
          <div>
            <ContributionGraph data={stats} />
          </div>
        </div>

        {/* Section 2: Recent Habits */}
        <div className="card compact" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>
            打卡概览
          </div>
          <div className="list">
            {rules.map((rule, index) => (
              <div
                key={rule._id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom:
                    index === rules.length - 1
                      ? "none"
                      : "1px solid var(--line)",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {rule.title}
                </div>
                <RuleHeatmap checkins={getRuleCheckins(rule._id)} days={14} />
              </div>
            ))}
            {!loading && rules.length === 0 && (
              <div className="card-muted">暂无打卡规则</div>
            )}
            {loading && <div className="card-muted">加载中...</div>}
          </div>
        </div>

        {/* Section 3: Details Tabs */}
        <div className="pill-toggle" style={{ marginBottom: 16 }}>
          <button
            className={tab === "flow" ? "active" : ""}
            onClick={() => setTab("flow")}
          >
            流水
          </button>
          <button
            className={tab === "exchange" ? "active" : ""}
            onClick={() => setTab("exchange")}
          >
            兑换
          </button>
        </div>
        {tab === "flow" ? <LedgerView /> : <ExchangeView />}
      </div>
    </div>
  );
}
