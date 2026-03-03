"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { useCouple } from "@/providers/CoupleProvider";

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { coupleId, memberCount, loading: coupleLoading } = useCouple();

  // Optimistic Redirect based on Cache
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const authCache = localStorage.getItem('auth_user');
        const coupleCache = localStorage.getItem('couple_data');
        
        if (authCache && coupleCache) {
            try {
                const coupleData = JSON.parse(coupleCache);
                if (coupleData.coupleId && coupleData.memberCount >= 2) {
                    // Valid cache exists, redirect immediately
                    router.replace("/home");
                    return;
                }
            } catch {
                // Ignore parse errors
            }
        }
    }
  }, [router]);

  useEffect(() => {
    if (authLoading || coupleLoading) return;

    if (!user) {
      router.replace("/auth/login");
      return;
    }

    if (!coupleId) {
      router.replace("/onboarding");
      return;
    }

    if (memberCount && memberCount >= 2) {
      router.replace("/home");
    } else {
      router.replace("/onboarding");
    }
  }, [authLoading, coupleLoading, user, coupleId, memberCount, router]);

  return <div className="page-center">正在加载空间…</div>;
}
