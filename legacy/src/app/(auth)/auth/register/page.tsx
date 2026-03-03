"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/cloudbase";
import { useToast } from "@/providers/ToastProvider";
import { useAuth } from "@/providers/AuthProvider";
import { getUserErrorMessage } from "@/utils/error";

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { pushToast } = useToast();

  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationId, setVerificationId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [step, setStep] = useState<0 | 1>(0); // 0: input info, 1: verify code

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/onboarding");
    }
  }, [user, authLoading, router]);

  const handleSendCode = async () => {
    if (!email || !email.includes("@")) {
      pushToast("请输入有效的邮箱地址", "error");
      return;
    }

    setSendingCode(true);
    try {
      const res = await auth.getVerification({
        email,
      });
      if (res.verification_id) {
        setVerificationId(res.verification_id);
        setStep(1);
        pushToast("验证码已发送至您的邮箱", "success");
      }
    } catch (error: any) {
      pushToast(error.message || "发送验证码失败", "error");
    } finally {
      setSendingCode(false);
    }
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (step === 0) {
      if (!nickname.trim()) {
        pushToast("昵称不能为空", "error");
        return;
      }
      if (!password || password.length < 6) {
        pushToast("密码至少需要 6 位", "error");
        return;
      }
      await handleSendCode();
      return;
    }

    if (!verificationCode) {
      pushToast("请输入验证码", "error");
      return;
    }

    setLoading(true);

    try {
      // 1. Verify code and get token
      const verifyRes = await auth.verify({
        verification_id: verificationId!,
        verification_code: verificationCode,
      });

      if (verifyRes.error) {
        throw new Error(verifyRes.error.message || "验证码校验失败");
      }

      // 2. Sign Up
      const signUpRes = await auth.signUp({
        email,
        password,
        verification_code: verificationCode,
        verification_token: verifyRes.data?.verification_token,
      });

      if (signUpRes.error) {
        throw new Error(signUpRes.error.message || "注册失败");
      }

      // 3. Sign In to get session
      const signInRes = await auth.signInWithPassword({
        email,
        password,
      });

      if (signInRes.error) {
        throw new Error(signInRes.error.message || "注册成功但自动登录失败，请尝试手动登录");
      }

      // In CloudBase JS SDK, auth.currentUser is updated after sign in
      const currentUser = auth.currentUser;
      const uid = currentUser?.uid;

      if (uid) {
        // 4. Create Profile
        const { data: profileData } = await db
          .collection("Profile")
          .where({ user_id: uid })
          .get();

        if (!profileData || profileData.length === 0) {
          await db.collection("Profile").add({
            user_id: uid,
            nickname: nickname.trim(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      } else {
        throw new Error("注册成功但无法获取当前登录用户信息，请尝试重新登录");
      }

      pushToast("注册成功，欢迎加入！", "success");
      router.replace("/onboarding");
    } catch (error: unknown) {
      pushToast(getUserErrorMessage(error, "注册失败"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ width: "min(420px, 90vw)" }}>
      <div className="hero">
        <div className="hero-title">创建情侣积分空间</div>
        <div className="hero-subtitle">
          {step === 0 ? "先注册账号，再开始你们的积分故事。" : `已向 ${email} 发送验证码`}
        </div>
      </div>

      <form className="form" onSubmit={handleRegister} style={{ marginTop: 16 }}>
        {step === 0 ? (
          <>
            <label>
              <div className="form-label">昵称</div>
              <input
                className="input"
                required
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="给自己取个昵称"
              />
            </label>
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
                placeholder="至少 6 位"
              />
            </label>
            <button className="btn" type="submit" disabled={sendingCode}>
              {sendingCode ? "发送中..." : "发送验证码"}
            </button>
          </>
        ) : (
          <>
            <label>
              <div className="form-label">验证码</div>
              <input
                className="input"
                required
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value)}
                placeholder="6 位数字验证码"
                maxLength={6}
              />
            </label>
            <button className="btn" type="submit" disabled={loading}>
              {loading ? "注册中…" : "立即注册"}
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => setStep(0)}
              disabled={loading}
              style={{ marginTop: 8 }}
            >
              返回修改信息
            </button>
          </>
        )}
      </form>

      <div style={{ marginTop: 12, fontSize: 14, color: "var(--muted)" }}>
        已有账号？ <Link href="/auth/login">去登录</Link>
      </div>
    </div>
  );
}
