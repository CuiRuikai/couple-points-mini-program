"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCouple } from "@/providers/CoupleProvider";
import { db } from "@/lib/cloudbase";

export function RequireCouple({ children }: { children: React.ReactNode }) {
  const { coupleId, memberCount, loading } = useCouple();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!coupleId) {
      router.replace("/onboarding");
    } else if (memberCount !== null && memberCount < 2) {
      router.replace("/onboarding");
    }
  }, [loading, coupleId, memberCount, router]);

  if (loading) {
    return <div className="page-center">正在读取情侣空间…</div>;
  }

  if (!coupleId) {
    return <div className="page-center">正在进入绑定流程…</div>;
  }

  if (memberCount !== null && memberCount < 2) {
    return <div className="page-center">正在跳转至绑定页面…</div>;
  }

  return <>{children}</>;
}
