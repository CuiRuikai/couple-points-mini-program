"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getUserErrorMessage, isCloudFunctionError } from "@/utils/error";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  pushToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  pushToast: () => undefined,
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const lastErrorRef = useRef<{ message: string; time: number }>({
    message: "",
    time: 0,
  });

  const pushToast = useCallback((message: string, type: ToastType = "info") => {
    const normalizedMessage =
      type === "error" ? getUserErrorMessage(message, "操作失败") : (message || "").trim();
    if (!normalizedMessage) return;

    if (type === "error") {
      const now = Date.now();
      if (
        lastErrorRef.current.message === normalizedMessage &&
        now - lastErrorRef.current.time < 1500
      ) {
        return;
      }
      lastErrorRef.current = { message: normalizedMessage, time: now };
    }

    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message: normalizedMessage }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, type === "error" ? 5200 : type === "success" ? 2600 : 3200);
  }, []);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isCloudFunctionError(event.reason)) return;
      pushToast(getUserErrorMessage(event.reason, "请求失败"), "error");
      event.preventDefault();
    };

    const handleWindowError = (event: ErrorEvent) => {
      if (!isCloudFunctionError(event.error)) return;
      pushToast(getUserErrorMessage(event.error, "请求失败"), "error");
      event.preventDefault();
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleWindowError);
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleWindowError);
    };
  }, [pushToast]);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
