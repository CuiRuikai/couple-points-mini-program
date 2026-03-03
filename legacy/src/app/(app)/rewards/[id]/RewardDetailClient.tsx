"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { auth, callFunction } from "@/lib/cloudbase";
import { useCouple } from "@/providers/CoupleProvider";
import { useToast } from "@/providers/ToastProvider";

export default function RewardDetailClient() {
  const params = useParams();
  const router = useRouter();
  const { role } = useCouple();
  const { pushToast } = useToast();
  const [reward, setReward] = useState<any | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [editTitle, setEditTitle] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const id = params?.id as string;

  useEffect(() => {
    const fetchData = async () => {
      setLoadError(null);
      try {
        // 使用云函数获取奖励详情，绕过数据库安全规则限制
        const rewardResult = await callFunction<any>("get_rewards", {
          rewardId: id,
          uid: auth.currentUser?.uid
        });

        if (rewardResult?.reward) {
          const r = rewardResult.reward;
          setReward(r);
          setEditTitle(r.title ?? "");
          setEditCost(r.cost_points?.toString() ?? "");
          setEditDescription(r.description ?? "");
          setEditActive(r.active ?? true);
        }

        const result = await callFunction<any>("get_dashboard", {
          uid: auth.currentUser?.uid
        });
        setBalance(result?.balance ?? 0);
      } catch (err) {
        const message = err instanceof Error ? err.message : "加载奖励详情失败";
        setLoadError(message || "加载奖励详情失败");
        pushToast(message || "加载奖励详情失败", "error");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchData();
  }, [id, pushToast]);

  const handleRedeem = async () => {
    if (!reward) return;
    try {
      await callFunction("request_redemption", {
        reward_id: reward._id,
        uid: auth.currentUser?.uid,
      });

      pushToast("兑换成功", "success");
      router.replace("/ledger");
    } catch (error: any) {
      pushToast(error.message || "兑换失败", "error");
    }
  };

  const handleUpdate = async () => {
    if (!reward) return;
    if (!editTitle.trim() || !editCost) {
      pushToast("请填写标题与所需积分", "error");
      return;
    }

    try {
      await callFunction("manage_reward", {
        action: "update",
        rewardId: reward._id,
        data: {
          title: editTitle.trim(),
          cost_points: Number(editCost),
          description: editDescription.trim() || null,
        },
        uid: auth.currentUser?.uid,
      });

      if (editActive !== Boolean(reward.active)) {
        await callFunction("manage_reward", {
          action: "toggle_active",
          rewardId: reward._id,
          uid: auth.currentUser?.uid,
        });
      }

      pushToast("奖励已更新", "success");
      setReward((prev: any) =>
        prev
          ? {
              ...prev,
              title: editTitle.trim(),
              cost_points: Number(editCost),
              description: editDescription.trim() || null,
              active: editActive,
            }
          : prev
      );
    } catch (error: any) {
      pushToast(error.message || "更新失败", "error");
    }
  };

  if (loading) {
    return (
      <div>
        <TopBar title="奖励详情" back />
        <div className="page">
          <div className="card">加载中…</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <TopBar title="奖励详情" back />
        <div className="page">
          <div className="card">{loadError}</div>
        </div>
      </div>
    );
  }

  if (!reward) {
    return (
      <div>
        <TopBar title="奖励详情" back />
        <div className="page">
          <div className="card">未找到奖励信息</div>
        </div>
      </div>
    );
  }

  const canRedeem = balance >= reward.cost_points;

  return (
    <div>
      <TopBar title="奖励详情" back />
      <div className="page">
        <div className="card">
          <div className="section-title">{reward.title}</div>
          <div style={{ marginTop: 8 }}>需要积分：{reward.cost_points}</div>
          {reward.description ? <div className="card-muted">{reward.description}</div> : null}
        </div>

        {role === "reviewer" ? (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">编辑奖励</div>
            <div className="form">
              <label>
                <div className="form-label">标题</div>
                <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </label>
              <label>
                <div className="form-label">所需积分</div>
                <input
                  className="input"
                  type="number"
                  value={editCost}
                  onChange={(e) => setEditCost(e.target.value)}
                />
              </label>
              <label>
                <div className="form-label">描述</div>
                <textarea
                  className="textarea"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </label>
              <label>
                <div className="form-label">状态</div>
                <select
                  className="select"
                  value={editActive ? "active" : "inactive"}
                  onChange={(e) => setEditActive(e.target.value === "active")}
                >
                  <option value="active">上架</option>
                  <option value="inactive">下架</option>
                </select>
              </label>
              <button className="btn" onClick={handleUpdate}>
                保存修改
              </button>
            </div>
          </div>
        ) : null}

        {role === "earner" ? (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">发起兑换</div>
            <div className="card-muted">当前余额：{balance}</div>
            <button className="btn" style={{ marginTop: 12 }} disabled={!canRedeem} onClick={handleRedeem}>
              {canRedeem ? "发起兑换" : "积分不足"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
