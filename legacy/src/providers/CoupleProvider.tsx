"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { getUserErrorMessage } from "@/utils/error";

export type MemberRole = "earner" | "reviewer";

const DEFAULT_THEME_COLOR = "#f6f1e6";
const THEME_COLOR_MAP: Record<MemberRole, string> = {
  earner: "#f0f7ff",
  reviewer: "#fff0f0",
};

interface CoupleState {
  coupleId: string | null;
  role: MemberRole | null;
  memberCount: number | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const CoupleContext = createContext<CoupleState>({
  coupleId: null,
  role: null,
  memberCount: null,
  loading: true,
  refresh: async () => undefined,
});

export function CoupleProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { pushToast } = useToast();
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [role, setRole] = useState<MemberRole | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const lastErrorAt = useRef(0);

  const notifyMembershipError = useCallback(
    (error: unknown, fallback: string) => {
      const now = Date.now();
      if (now - lastErrorAt.current < 3000) return;
      pushToast(getUserErrorMessage(error, fallback), "error");
      lastErrorAt.current = now;
    },
    [pushToast]
  );

  const clearMembership = useCallback(() => {
    setCoupleId(null);
    setRole(null);
    setMemberCount(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("couple_data");
    }
  }, []);

  const fetchMembership = useCallback(async () => {
    if (authLoading) {
      return;
    }

    const uid = user?.uid;
    if (!uid) {
      clearMembership();
      setLoading(false);
      return;
    }

    let hasCache = false;
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("couple_data");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.coupleId) {
            hasCache = true;
            setCoupleId(parsed.coupleId);
            setRole(parsed.role);
            setMemberCount(parsed.memberCount);
            setLoading(false);
          }
        } catch (e) {
          console.error("Parse couple cache failed", e);
        }
      }
    }
    
    try {
      const { callFunction } = await import("@/lib/cloudbase");
      const result = await callFunction("get_dashboard", { uid });

      if (result && result.couple_id) {
        setCoupleId(result.couple_id);
        setRole(result.role as MemberRole);
        setMemberCount(result.member_count ?? null);
        
        // Update Cache
        if (typeof window !== "undefined") {
          localStorage.setItem(
            "couple_data",
            JSON.stringify({
              coupleId: result.couple_id,
              role: result.role,
              memberCount: result.member_count,
            })
          );
        }
      } else {
        clearMembership();
      }
    } catch (err) {
      notifyMembershipError(err, "加载情侣空间失败，请稍后重试");
      // 未命中缓存时，避免保留脏状态
      if (!hasCache) {
        clearMembership();
      }
    } finally {
      setLoading(false);
    }
  }, [authLoading, clearMembership, notifyMembershipError, user?.uid]);

  useEffect(() => {
    fetchMembership();
  }, [fetchMembership]);

  // Handle Theme Switching
  useEffect(() => {
    if (typeof document !== "undefined") {
      if (role === "reviewer") {
        document.body.classList.add("theme-pink");
        document.body.classList.remove("theme-blue");
      } else if (role === "earner") {
        document.body.classList.add("theme-blue");
        document.body.classList.remove("theme-pink");
      } else {
        document.body.classList.remove("theme-pink");
        document.body.classList.remove("theme-blue");
      }

      const themeColor = role ? THEME_COLOR_MAP[role] : DEFAULT_THEME_COLOR;
      let meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "theme-color");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", themeColor);
    }
  }, [role]);

  const value = useMemo(
    () => ({
      coupleId,
      role,
      memberCount,
      loading,
      refresh: fetchMembership,
    }),
    [coupleId, role, memberCount, loading, fetchMembership]
  );

  return <CoupleContext.Provider value={value}>{children}</CoupleContext.Provider>;
}

export function useCouple() {
  return useContext(CoupleContext);
}
