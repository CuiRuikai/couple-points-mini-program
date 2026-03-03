"use client";

import { useCallback, useEffect, useState } from "react";
import { callFunction, cloud } from "@/lib/cloudbase";
import { useCouple } from "@/providers/CoupleProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useDashboard } from "@/hooks/useDashboard";

interface ExchangeReward {
  _id: string;
  title: string;
  cost_points: number;
  description?: string | null;
  image_url?: string | null;
  active: boolean;
  redeemed_count?: number;
  used_count?: number;
  remaining_count?: number;
}

interface RewardUsageSummary {
  reward_id: string;
  redeemed_count: number;
  used_count: number;
  remaining_count: number;
}

export default function ExchangeView() {
  const { role, coupleId } = useCouple();
  const { user } = useAuth();
  const { pushToast } = useToast();
  const { dashboard } = useDashboard();

  const [rewards, setRewards] = useState<ExchangeReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [actioningKey, setActioningKey] = useState("");
  const [imageUrlMap, setImageUrlMap] = useState<Record<string, string>>({});
  const [hintText, setHintText] = useState("");

  const fetchExchangeData = useCallback(async () => {
    if (!coupleId || !user?.uid) return;
    setLoading(true);
    try {
      const [rewardsRes, usageRes, dashboardRes] = await Promise.all([
        callFunction<any>("get_rewards", { uid: user.uid }),
        callFunction<RewardUsageSummary[]>("get_reward_usage_summary", { uid: user.uid }).catch(
          () => []
        ),
        callFunction<any>("get_dashboard", { uid: user.uid }).catch(() => null)
      ]);

      const usageMap = new Map<string, RewardUsageSummary>(
        (Array.isArray(usageRes) ? usageRes : []).map((item) => [item.reward_id, item])
      );

      const rewardList: ExchangeReward[] = (rewardsRes?.rewards ?? [])
        .filter((item: ExchangeReward) => item.active)
        .map((item: ExchangeReward) => {
          const usage = usageMap.get(item._id);
          const redeemed = usage?.redeemed_count ?? (Number(item.redeemed_count) || 0);
          const used = usage?.used_count ?? (Number(item.used_count) || 0);
          const remaining = usage?.remaining_count ?? Math.max(redeemed - used, 0);
          return {
            ...item,
            redeemed_count: redeemed,
            used_count: used,
            remaining_count: remaining
          };
        });

      setRewards(rewardList);
      if (dashboardRes?.balance !== undefined && dashboardRes?.balance !== null) {
        setBalance(Number(dashboardRes.balance) || 0);
      } else if (dashboard?.balance !== undefined && dashboard?.balance !== null) {
        setBalance(Number(dashboard.balance) || 0);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "奖励数据加载失败，请稍后重试";
      setHintText(message || "奖励数据加载失败，请稍后重试");
      pushToast(message || "奖励数据加载失败，请稍后重试", "error");
    } finally {
      setLoading(false);
    }
  }, [coupleId, dashboard?.balance, pushToast, user?.uid]);

  useEffect(() => {
    fetchExchangeData();
  }, [fetchExchangeData]);

  useEffect(() => {
    if (dashboard?.balance !== undefined && dashboard?.balance !== null) {
      setBalance(Number(dashboard.balance) || 0);
    }
  }, [dashboard?.balance]);

  useEffect(() => {
    const cloudImageIds = Array.from(
      new Set(
        rewards
          .map((item) => item.image_url?.trim())
          .filter((value): value is string => !!value && value.startsWith("cloud://"))
      )
    );

    if (cloudImageIds.length === 0) {
      setImageUrlMap({});
      return;
    }

    let cancelled = false;
    cloud
      .getTempFileURL({ fileList: cloudImageIds })
      .then((res: any) => {
        if (cancelled) return;
        const nextMap: Record<string, string> = {};
        (res?.fileList ?? []).forEach((item: any) => {
          if (item?.fileID && item?.tempFileURL) {
            nextMap[item.fileID] = item.tempFileURL;
          }
        });
        setImageUrlMap(nextMap);
      })
      .catch((error: any) => {
        console.error("Resolve exchange image URL failed", error);
      });

    return () => {
      cancelled = true;
    };
  }, [rewards]);

  const resolveRewardImageSrc = useCallback(
    (imageUrl?: string | null) => {
      const raw = imageUrl?.trim() || "";
      if (!raw) return "";
      if (raw.startsWith("cloud://")) return imageUrlMap[raw] || "";
      return raw;
    },
    [imageUrlMap]
  );

  const handleExchange = async (reward: ExchangeReward) => {
    if (role !== "earner") return;
    const cost = Number(reward.cost_points) || 0;
    if (cost <= 0) {
      setHintText("奖励积分配置异常");
      return;
    }
    if (balance < cost) {
      setHintText("积分不足，无法兑换");
      return;
    }

    const actionKey = `redeem_${reward._id}`;
    setActioningKey(actionKey);
    setHintText("");
    try {
      await callFunction("request_redemption", {
        reward_id: reward._id,
        uid: user?.uid
      });
      setBalance((prev) => prev - cost);
      setRewards((prev) =>
        prev.map((item) =>
          item._id === reward._id
            ? {
                ...item,
                redeemed_count: (Number(item.redeemed_count) || 0) + 1,
                remaining_count: (Number(item.remaining_count) || 0) + 1
              }
            : item
        )
      );
      setHintText(`已兑换：${reward.title}`);
    } catch (error: any) {
      const message = error?.message || "兑换失败";
      setHintText(message);
      pushToast(message, "error");
    } finally {
      setActioningKey("");
    }
  };

  const handleUse = async (reward: ExchangeReward) => {
    if (role !== "earner") return;
    const remaining = Number(reward.remaining_count) || 0;
    if (remaining < 1) {
      setHintText("暂无可核销次数");
      return;
    }

    const actionKey = `use_${reward._id}`;
    setActioningKey(actionKey);
    setHintText("");
    try {
      await callFunction("request_reward_use", {
        reward_id: reward._id,
        uid: user?.uid
      });
      setRewards((prev) =>
        prev.map((item) =>
          item._id === reward._id
            ? {
                ...item,
                used_count: (Number(item.used_count) || 0) + 1,
                remaining_count: Math.max((Number(item.remaining_count) || 0) - 1, 0)
              }
            : item
        )
      );
      setHintText(`已核销：${reward.title}`);
    } catch (error: any) {
      const message = error?.message || "核销失败";
      setHintText(message);
      pushToast(message, "error");
    } finally {
      setActioningKey("");
    }
  };

  const hasRewards = rewards.length > 0;

  return (
    <div className="exchange-view">
      <div className="card exchange-balance-card">
        <div className="card-muted">当前可用积分</div>
        <div className="kpi" style={{ color: "var(--brand-strong)" }}>
          {balance}
        </div>
      </div>
      {hintText ? <div className="card-muted exchange-hint">{hintText}</div> : null}

      <div className="exchange-grid">
        {rewards.map((reward) => {
          const imageSrc = resolveRewardImageSrc(reward.image_url);
          const remainingCount = Number(reward.remaining_count) || 0;
          const redeemedCount = Number(reward.redeemed_count) || 0;
          const usedCount = Number(reward.used_count) || 0;
          const canRedeem = role === "earner" && balance >= reward.cost_points;
          const canUse = role === "earner" && remainingCount > 0;
          const redeemLoading = actioningKey === `redeem_${reward._id}`;
          const useLoading = actioningKey === `use_${reward._id}`;

          return (
            <div key={reward._id} className="card exchange-item-card">
              <div className="reward-cover exchange-reward-cover">
                {imageSrc ? (
                  <img src={imageSrc} alt={reward.title} className="reward-cover-image" />
                ) : (
                  <div className="reward-cover-fallback">🎁</div>
                )}
                <div className="reward-cover-mask" />
              </div>

              <div className="exchange-item-header">
                <div className="exchange-item-title">{reward.title}</div>
                <div className="exchange-item-points">{reward.cost_points} 分</div>
              </div>

              <div className="exchange-item-meta">
                <span className="badge gray exchange-item-badge">可核销 {remainingCount}</span>
                <div className="exchange-item-subtle">
                  兑 {redeemedCount} / 销 {usedCount}
                </div>
              </div>

              <div className="exchange-action-row">
                <button
                  className={`btn exchange-action-btn ${canRedeem ? "" : "secondary"}`}
                  onClick={() => handleExchange(reward)}
                  disabled={!canRedeem || redeemLoading || useLoading}
                >
                  {redeemLoading ? "兑换中…" : "兑换"}
                </button>
                <button
                  className={`btn secondary exchange-action-btn ${canUse ? "" : "is-done"}`}
                  onClick={() => handleUse(reward)}
                  disabled={!canUse || redeemLoading || useLoading}
                >
                  {useLoading ? "核销中…" : "核销"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!hasRewards && !loading ? <div className="card exchange-empty">暂无可兑换礼物</div> : null}
      {loading ? <div className="card exchange-empty">加载中…</div> : null}
    </div>
  );
}
