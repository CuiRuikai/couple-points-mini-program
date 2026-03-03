import { useCallback, useEffect, useState } from "react";
import { DashboardService } from "@/services/dashboard";
import { DashboardData } from "@/types";
import { useCouple } from "@/providers/CoupleProvider";
import { useToast } from "@/providers/ToastProvider";
import { useRouter } from "next/navigation";

export function useDashboard() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { coupleId, loading: coupleLoading } = useCouple();

  const fetchDashboard = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await DashboardService.getDashboard();
        if (data) {
          setDashboard(data);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "加载首页数据失败";
        pushToast(message || "加载首页数据失败", "error");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [pushToast]
  );

  useEffect(() => {
    if (coupleLoading) return;
    if (!coupleId) {
      router.replace("/onboarding");
      return;
    }

    const cached = DashboardService.getCachedDashboard();
    if (cached) {
      setDashboard(cached);
    }

    fetchDashboard();
  }, [coupleId, coupleLoading, fetchDashboard, router]);

  const refresh = useCallback(async () => {
    await fetchDashboard(true);
  }, [fetchDashboard]);

  return { dashboard, loading, refresh };
}
