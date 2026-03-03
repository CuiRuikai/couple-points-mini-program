"use client";

import Link from "next/link";
import { useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { useCouple } from "@/providers/CoupleProvider";
import { useAuth } from "@/providers/AuthProvider";
import { callFunction } from "@/lib/cloudbase";
import { useToast } from "@/providers/ToastProvider";
import { useDashboard } from "@/hooks/useDashboard";
import { getUserErrorMessage } from "@/utils/error";

import { ProfileCard } from "@/components/mine/ProfileCard";

export default function MinePage() {
  const { role } = useCouple();
  const { user } = useAuth();
  const { pushToast } = useToast();
  const { dashboard } = useDashboard();

  const [anniversaryDate, setAnniversaryDate] = useState("");
  const [showDateInput, setShowDateInput] = useState(false);

  const handleUpdateAnniversary = async () => {
    if (!anniversaryDate) return;
    try {
      await callFunction("manage_couple", {
        action: "update_anniversary",
        data: { date: anniversaryDate },
        uid: user?.uid,
      });
      pushToast("更新成功", "success");
      setShowDateInput(false);
      window.location.reload();
    } catch (err) {
      pushToast(getUserErrorMessage(err, "更新失败"), "error");
    }
  };

  return (
    <div>
      <TopBar title="我的" />
      <div className="page">
        {/* Profile Card */}
        <div style={{ marginBottom: 16 }}>
          <ProfileCard />
        </div>

        <div className="card">
          <div className="section-title" style={{ marginBottom: 12 }}>
            功能入口
          </div>
          <div className="list">
            {role === "reviewer" && (
              <Link className="list-item" href="/rewards">
                奖励管理
              </Link>
            )}
            <Link className="list-item" href="/quick-score">
              快捷加减分项目
            </Link>
            
            <div
              className="list-item"
              onClick={() => setShowDateInput(!showDateInput)}
              style={{ cursor: "pointer" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                }}
              >
                <span>设置纪念日</span>
                <span className="card-muted">
                  {dashboard?.anniversary_date || "未设置"}
                </span>
              </div>
            </div>
            {showDateInput && (
              <div className="form" style={{ padding: "0 12px 12px" }}>
                <input
                  type="date"
                  className="input"
                  value={anniversaryDate}
                  onChange={(e) => setAnniversaryDate(e.target.value)}
                />
                <button className="btn" onClick={handleUpdateAnniversary}>
                  保存
                </button>
              </div>
            )}
            
            <Link className="list-item" href="/settings">
              系统设置
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
