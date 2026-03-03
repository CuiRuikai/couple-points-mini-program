"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return <div className="page-center">正在验证登录状态…</div>;
  }

  if (!user) {
    return <div className="page-center">正在跳转登录…</div>;
  }

  return <>{children}</>;
}
