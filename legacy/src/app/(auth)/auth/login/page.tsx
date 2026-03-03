"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/cloudbase";
import { useToast } from "@/providers/ToastProvider";
import { useAuth } from "@/providers/AuthProvider";
import { getUserErrorMessage } from "@/utils/error";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { pushToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/home");
    }
  }, [user, authLoading, router]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      const loginRes = await auth.signInWithPassword({
        email,
        password,
      });

      if (loginRes.error) {
        throw new Error(loginRes.error.message || "登录失败");
      }

      // Wait a bit for AuthProvider to update via onAuthStateChange
      await new Promise((resolve) => setTimeout(resolve, 500));

      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("登录成功但未获取到用户信息，请尝试刷新页面");
      }

      const { data: membershipData } = await db
        .collection("CoupleMember")
        .where({ user_id: currentUser.uid })
        .get();

      if (membershipData && membershipData.length > 0) {
        // 只要有成员记录，就说明已经参与了空间（无论是创建者还是加入者）
        router.replace("/home");
      } else {
        router.replace("/onboarding");
      }

      pushToast("欢迎回来！", "success");
    } catch (error: unknown) {
      pushToast(getUserErrorMessage(error, "登录失败"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ width: "min(420px, 90vw)" }}>
      <div className="hero">
        <div className="hero-title">欢迎回到情侣积分</div>
        <div className="hero-subtitle">登陆后继续记录你们的日常。</div>
      </div>
      <form className="form" onSubmit={handleLogin} style={{ marginTop: 16 }}>
        <label>
          <div className="form-label">邮箱</div>
          <input
            className="input"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label>
          <div className="form-label">密码</div>
          <input
            className="input"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
        </label>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "登录中…" : "登录"}
        </button>
      </form>
      <div style={{ marginTop: 12, fontSize: 14, color: "var(--muted)" }}>
        还没有账号？ <Link href="/auth/register">去注册</Link>
      </div>
    </div>
  );
}
