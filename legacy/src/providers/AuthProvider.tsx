"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { auth } from "@/lib/cloudbase";
import { useToast } from "@/providers/ToastProvider";
import { getUserErrorMessage } from "@/utils/error";

const AUTH_CACHE_KEY = "auth_user";
const AUTH_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface SafeAuthUser {
  uid?: string;
  displayName?: string;
  photoURL?: string;
  email?: string;
  nickName?: string;
  avatarUrl?: string;
  loginType?: string;
}

interface CachedAuthUser {
  user: SafeAuthUser;
  cached_at: number;
}

interface AuthState {
  user: SafeAuthUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
});

function readCachedUser(): SafeAuthUser | null {
  if (typeof window === "undefined") return null;
  const cached = localStorage.getItem(AUTH_CACHE_KEY);
  if (!cached) return null;
  try {
    const parsed = JSON.parse(cached) as CachedAuthUser | SafeAuthUser;
    if (parsed && typeof parsed === "object" && "user" in parsed && "cached_at" in parsed) {
      const withMeta = parsed as CachedAuthUser;
      if (!withMeta.cached_at || Date.now() - withMeta.cached_at > AUTH_CACHE_TTL_MS) {
        localStorage.removeItem(AUTH_CACHE_KEY);
        return null;
      }
      return withMeta.user ?? null;
    }
    // Backward compatibility for old cache structure
    return parsed as SafeAuthUser;
  } catch (e) {
    console.error("Parse user cache failed", e);
    return null;
  }
}

function writeCachedUser(user: SafeAuthUser) {
  if (typeof window === "undefined") return;
  const payload: CachedAuthUser = {
    user,
    cached_at: Date.now(),
  };
  localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(payload));
}

function clearCachedUser() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_CACHE_KEY);
}

function toSafeUser(source: any): SafeAuthUser {
  return {
    uid: source?.uid,
    displayName: source?.displayName,
    photoURL: source?.photoURL,
    email: source?.email,
    nickName: source?.nickName,
    avatarUrl: source?.avatarUrl,
    loginType: source?.loginType,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { pushToast } = useToast();
  const [user, setUser] = useState<SafeAuthUser | null>(() => readCachedUser());
  const [loading, setLoading] = useState(true);
  const lastErrorAt = useRef(0);

  const notifyAuthError = useCallback((error: unknown, fallback: string) => {
    const now = Date.now();
    if (now - lastErrorAt.current < 3000) return;
    pushToast(getUserErrorMessage(error, fallback), "error");
    lastErrorAt.current = now;
    }, [pushToast]);

  const applyCachedUser = useCallback(() => {
    const cached = readCachedUser();
    if (cached) {
      setUser(cached);
      return true;
    }
    return false;
  }, []);

  const refreshUser = useCallback(async (options?: { allowCacheFallback?: boolean; notifyOnError?: boolean }) => {
    const allowCacheFallback = options?.allowCacheFallback ?? true;
    const notifyOnError = options?.notifyOnError ?? true;
    try {
      const loginState = await auth.getLoginState();
      const currentUser = auth.currentUser || (loginState?.user as any) || null;
      if (!currentUser) {
        clearCachedUser();
        setUser(null);
        return;
      }

      const safeUser = toSafeUser(currentUser);

      // 获取最新 Profile（失败时不阻断登录态恢复）
      const { callFunction } = await import("@/lib/cloudbase");
      try {
        const profile: any = await callFunction("get_profile", { uid: currentUser.uid });
        if (profile) {
          safeUser.displayName = profile.nickname || safeUser.displayName || safeUser.nickName;
          safeUser.photoURL = profile.avatar_url || safeUser.photoURL || safeUser.avatarUrl;
        }
      } catch (profileErr) {
        if (notifyOnError) {
          notifyAuthError(profileErr, "读取用户资料失败");
        }
      }

      writeCachedUser(safeUser);
      setUser(safeUser);
    } catch (err) {
      if (allowCacheFallback && applyCachedUser()) return;
      clearCachedUser();
      setUser(null);
      if (notifyOnError) {
        notifyAuthError(err, "登录状态刷新失败，请重新登录");
      }
    }
  }, [applyCachedUser, notifyAuthError]);

  useEffect(() => {
    // 监听登录状态变化
    const unsubscribe = auth.onAuthStateChange((event: any, session: any) => {
      void event;
      void session;
      if (event === "SIGNED_OUT") {
        clearCachedUser();
        setUser(null);
        setLoading(false);
        return;
      }

      void refreshUser({
        allowCacheFallback: true,
        notifyOnError: false,
      }).finally(() => {
        setLoading(false);
      });
    });

    // 初始化获取状态
    const initAuth = async () => {
      try {
        await refreshUser({
          allowCacheFallback: true,
          notifyOnError: false,
        });
      } catch (err) {
        notifyAuthError(err, "初始化登录状态失败");
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      // 如果 SDK 支持取消订阅，通常返回一个 unsubscribe 函数
      // CloudBase 的 onAuthStateChange 返回的对象中包含 unsubscribe
      if (typeof unsubscribe === "function") {
        (unsubscribe as any)();
      } else if (unsubscribe && (unsubscribe as any).data?.subscription?.unsubscribe) {
        (unsubscribe as any).data.subscription.unsubscribe();
      }
    };
  }, [notifyAuthError, refreshUser]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
