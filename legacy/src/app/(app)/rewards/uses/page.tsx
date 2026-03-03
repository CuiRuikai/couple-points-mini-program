"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { auth, callFunction, db } from "@/lib/cloudbase";
import { useCouple } from "@/providers/CoupleProvider";
import { useToast } from "@/providers/ToastProvider";
import { formatDateTime } from "@/utils/date";

interface UsageSummary {
  reward_id: string;
  title: string;
  cost_points: number;
  redeemed_count: number;
  used_count: number;
  remaining_count: number;
}

interface UsageItem {
  _id: string;
  reward_id: string;
  created_at: string;
  reward_title?: string | null;
}

export default function RewardUsesPage() {
  const { role, coupleId } = useCouple();
  const { pushToast } = useToast();
  const [summary, setSummary] = useState<UsageSummary[]>([]);
  const [history, setHistory] = useState<UsageItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!coupleId) return;
    setLoading(true);
    try {
      const summaryData = await callFunction<UsageSummary[]>("get_reward_usage_summary", {
        uid: auth.currentUser?.uid
      });
      setSummary(Array.isArray(summaryData) ? summaryData : []);

      const { data: usageData } = await db
        .collection("RewardUsage")
        .aggregate()
        .match({ couple_id: coupleId })
        .sort({ created_at: -1 })
        .limit(40)
        .lookup({
          from: "Reward",
          localField: "reward_id",
          foreignField: "_id",
          as: "reward",
        })
        .end();

      const mapped = (usageData ?? []).map((item: any) => ({
        ...item,
        reward_title: item.reward?.[0]?.title ?? null,
      }));

      setHistory(mapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载奖励使用数据失败";
      pushToast(message || "加载奖励使用数据失败", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [coupleId]);

  const handleRequestUse = async (rewardId: string) => {
    try {
      await callFunction("request_reward_use", {
        reward_id: rewardId,
        uid: auth.currentUser?.uid,
      });

      pushToast("奖励已使用", "success");
      fetchData();
    } catch (error: any) {
      pushToast(error.message || "使用失败", "error");
    }
  };

  const visibleSummary = summary.filter(
    (item) => item.redeemed_count > 0 || item.used_count > 0
  );

  return (
    <div>
      <TopBar title="奖励使用" />
      <div className="page">
        <div className="card">
          <div className="card-title">已兑换奖励清单</div>
          <div className="list" style={{ marginTop: 12 }}>
            {visibleSummary.map((item) => (
              <div key={item.reward_id} className="list-item">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{item.title}</strong>
                  <span>{item.cost_points} 分</span>
                </div>
                <div className="card-muted">
                  已兑换 {item.redeemed_count} · 已使用 {item.used_count}
                </div>
                <div className="card-muted">剩余可用：{item.remaining_count}</div>
                {role === "earner" ? (
                  <button
                    className="btn"
                    style={{ marginTop: 8 }}
                    disabled={item.remaining_count <= 0}
                    onClick={() => handleRequestUse(item.reward_id)}
                  >
                    {item.remaining_count > 0 ? "立即使用" : "暂无可用"}
                  </button>
                ) : null}
              </div>
            ))}
            {!loading && visibleSummary.length === 0 ? (
              <div className="card-muted">暂无奖励兑换记录</div>
            ) : null}
            {loading ? <div className="card-muted">加载中…</div> : null}
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">使用记录</div>
          <div className="list" style={{ marginTop: 12 }}>
            {history.map((item) => (
              <div key={item._id} className="list-item">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{item.reward_title ?? "奖励使用"}</strong>
                  <span>已使用</span>
                </div>
                <div className="card-muted">{formatDateTime(item.created_at)}</div>
              </div>
            ))}
            {!loading && history.length === 0 ? <div className="card-muted">暂无使用记录</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
