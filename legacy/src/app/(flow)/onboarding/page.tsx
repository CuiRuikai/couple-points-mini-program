"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, callFunction, db } from "@/lib/cloudbase";
import { TopBar } from "@/components/layout/TopBar";
import { useToast } from "@/providers/ToastProvider";
import { useCouple } from "@/providers/CoupleProvider";

export default function OnboardingPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const { coupleId, loading: coupleLoading, refresh } = useCouple();
  const lastStatusErrorAt = useRef(0);
  const [mode, setMode] = useState<"create" | "join">("create");
  const [role, setRole] = useState<"earner" | "reviewer" | "">("");
  const [joinCode, setJoinCode] = useState("");
  const [coupleCode, setCoupleCode] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const loadCoupleStatus = useCallback(async () => {
    if (!coupleId) return;
    setStatusLoading(true);

    try {
      // 使用云函数获取状态
      const result = await callFunction("get_dashboard", { uid: auth.currentUser?.uid });

      if (result) {
        setMemberCount(result.member_count);
        // 如果已经有两个人了，直接去首页
        if (result.member_count >= 2) {
          router.replace("/home");
          return;
        }
      }

      // 获取邀请码还是需要查 Couple 表，这个表通常设置为所有人可读或创建者可读
      const coupleRes = await db.collection("Couple").doc(coupleId).get();
      if (coupleRes.data && coupleRes.data.length > 0) {
        setCoupleCode(coupleRes.data[0].invite_code || null);
      }
    } catch (err) {
      const now = Date.now();
      if (now - lastStatusErrorAt.current > 10000) {
        const message = err instanceof Error ? err.message : "加载绑定状态失败";
        pushToast(message || "加载绑定状态失败", "error");
        lastStatusErrorAt.current = now;
      }
    } finally {
      setStatusLoading(false);
    }
  }, [coupleId, pushToast, router]);

  useEffect(() => {
    if (coupleLoading || !coupleId) {
      setMemberCount(null);
      setCoupleCode(null);
      return;
    }

    setMode("create");
    loadCoupleStatus();
  }, [coupleId, coupleLoading, loadCoupleStatus]);

  useEffect(() => {
    if (coupleId && memberCount !== null && memberCount >= 2) {
      router.replace("/home");
    }
  }, [coupleId, memberCount, router]);

  useEffect(() => {
    if (!coupleId || memberCount !== 1) return;
    const timer = setInterval(() => {
      loadCoupleStatus();
    }, 4000);
    return () => clearInterval(timer);
  }, [coupleId, memberCount, loadCoupleStatus]);

  const handleCreate = async () => {
    if (!role) {
      pushToast("请选择你的角色", "error");
      return;
    }

    setLoading(true);
    try {
      const result = await callFunction("create_couple", {
        role,
        uid: auth.currentUser?.uid
      });

      setCoupleCode(result.invite_code || null);
      pushToast("空间创建成功", "success");
      await refresh();
      await loadCoupleStatus();
    } catch (error: any) {
      pushToast(error.message || "创建失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) {
      pushToast("请输入邀请码", "error");
      return;
    }

    setLoading(true);
    try {
      await callFunction("join_couple", {
        invite_code: joinCode.trim(),
        uid: auth.currentUser?.uid
      });

      pushToast("加入成功", "success");
      await refresh();
      router.replace("/home");
    } catch (error: any) {
      pushToast(error.message || "加入失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!coupleCode) return;
    try {
      await navigator.clipboard.writeText(coupleCode);
      pushToast("邀请码已复制", "success");
    } catch {
      pushToast("复制失败，请手动复制", "error");
    }
  };

  const handleShare = async () => {
    if (!coupleCode) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "情侣积分邀请码",
          text: `邀请码：${coupleCode}`,
        });
      } else {
        await handleCopy();
      }
    } catch {
      handleCopy();
    }
  };

  if (coupleLoading) {
    return (
      <div className="page-center">
        <div className="card-muted">正在加载空间信息…</div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="情侣空间绑定" />
      <div className="page">
        <div className="pill-toggle" role="tablist">
          <button
            type="button"
            className={mode === "create" ? "active" : ""}
            onClick={() => setMode("create")}
          >
            创建空间
          </button>
          <button
            type="button"
            className={mode === "join" ? "active" : ""}
            onClick={() => setMode("join")}
          >
            输入邀请码加入
          </button>
        </div>

        {mode === "create" ? (
          <div className="card" style={{ marginTop: 16 }}>
            {!coupleId ? (
              <>
                <div className="card-title">选择你的角色</div>
                <div className="grid two" style={{ marginBottom: 12 }}>
                  <button
                    type="button"
                    className={`btn secondary ${role === "earner" ? "active" : ""}`}
                    onClick={() => setRole("earner")}
                  >
                    积分方
                  </button>
                  <button
                    type="button"
                    className={`btn secondary ${role === "reviewer" ? "active" : ""}`}
                    onClick={() => setRole("reviewer")}
                  >
                    管理方
                  </button>
                </div>
                <button className="btn" onClick={handleCreate} disabled={loading}>
                  {loading ? "创建中…" : "创建并生成邀请码"}
                </button>
              </>
            ) : null}

            {coupleId || coupleCode ? (
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-title">你的邀请码</div>
                <div style={{ fontSize: 26, fontWeight: 600 }}>{coupleCode ?? "加载中…"}</div>
                <div className="card-muted" style={{ marginTop: 8 }}>
                  {memberCount === 1
                    ? "等待另一半输入邀请码加入"
                    : memberCount !== null && memberCount >= 2
                      ? "对方已加入，可进入空间"
                      : "正在确认绑定状态…"}
                </div>
                <div className="inline-actions" style={{ marginTop: 10 }}>
                  <button className="btn secondary" onClick={handleCopy}>
                    复制
                  </button>
                  <button className="btn" onClick={handleShare}>
                    一键分享
                  </button>
                </div>
                <button
                  className="btn ghost"
                  style={{ marginTop: 12 }}
                  onClick={loadCoupleStatus}
                  disabled={statusLoading}
                >
                  {statusLoading ? "正在刷新…" : "刷新加入状态"}
                </button>
                {memberCount !== null && memberCount >= 2 ? (
                  <button
                    className="btn"
                    style={{ marginTop: 10 }}
                    onClick={() => router.replace("/home")}
                  >
                    进入首页
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="card" style={{ marginTop: 16 }}>
            {coupleId ? (
              <>
                <div className="card-title">你已加入空间</div>
                <div className="card-muted" style={{ marginTop: 8 }}>
                  无需重复加入，等待对方完成绑定即可进入。
                </div>
                <button className="btn" style={{ marginTop: 12 }} onClick={() => setMode("create")}>
                  返回邀请码页面
                </button>
              </>
            ) : (
              <>
                <div className="card-title">加入情侣空间</div>
                <label>
                  <div className="form-label">邀请码</div>
                  <input
                    className="input"
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value)}
                    placeholder="输入 8 位邀请码"
                  />
                </label>
                <button className="btn" style={{ marginTop: 12 }} onClick={handleJoin} disabled={loading}>
                  {loading ? "加入中…" : "加入"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
