"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { formatDate, formatDateTime } from "@/utils/date";
import { formatPoints, formatTxnType } from "@/utils/format";
import { useToast } from "@/providers/ToastProvider";
import { DataService } from "@/services/data";
import { Transaction, Rule, Reward } from "@/types/models";

export default function LedgerDetailClient() {
  const params = useParams();
  const { pushToast } = useToast();

  const [item, setItem] = useState<Transaction | null>(null);
  const [rule, setRule] = useState<Rule | null>(null);
  const [reward, setReward] = useState<Reward | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const id = params?.id as string;

  useEffect(() => {
    const fetchItem = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const t = await DataService.getTransactionDetail(id);

        if (t) {
          setItem(t);

          if (t.rule_id) {
            const ruleData = await DataService.getRule(t.rule_id);
            setRule(ruleData);
          }

          if (t.type === "redemption" && t.redemption_id) {
             const redemptionData = await DataService.getRedemption(t.redemption_id);
             if (redemptionData?.reward_id) {
               const rewardData = await DataService.getReward(redemptionData.reward_id);
               setReward(rewardData);
             }
          }
        } else {
          setLoadError("未找到流水记录");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "加载流水详情失败";
        setLoadError(message || "加载流水详情失败");
        pushToast(message || "加载流水详情失败", "error");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchItem();
  }, [id, pushToast]);

  if (loading) {
    return (
      <div>
        <TopBar title="流水详情" back />
        <div className="page">
          <div className="card">加载中…</div>
        </div>
      </div>
    );
  }

  if (loadError || !item) {
    return (
      <div>
        <TopBar title="流水详情" back />
        <div className="page">
          <div className="card">{loadError || "未找到流水记录"}</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="流水详情" back />
      <div className="page">
        <div className="card">
          <div className="section-title">{item.title}</div>
          {item.note ? <div style={{ marginTop: 6 }}>{item.note}</div> : null}
          <div className="divider" />
          <div className="grid">
            <div>
              <div className="form-label">类型</div>
              <div>{formatTxnType(item.type)}</div>
            </div>
            <div>
              <div className="form-label">建议分值</div>
              <div>{formatPoints(item.points_suggested)}</div>
            </div>
            <div>
              <div className="form-label">最终分值</div>
              <div>{formatPoints(item.points_final)}</div>
            </div>
            <div>
              <div className="form-label">发生日期</div>
              <div>{formatDate(item.event_date)}</div>
            </div>
            <div>
              <div className="form-label">创建时间</div>
              <div>{formatDateTime(item.created_at)}</div>
            </div>
          </div>

          {rule ? (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="card-title">关联规则</div>
              <div>{rule.title}</div>
              <div className="card-muted">每日</div>
            </div>
          ) : null}

          {reward ? (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="card-title">关联奖励</div>
              <div>{reward.title}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
