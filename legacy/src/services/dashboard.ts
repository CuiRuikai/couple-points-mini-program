import { auth, callFunction } from "@/lib/cloudbase";
import { DashboardData } from "@/types";
import { CacheUtils } from "@/utils/cache";

const CACHE_KEY = "cp_dashboard_data";
const CACHE_TTL = 300; // 5 minutes

export class DashboardService {
  static async getDashboard(): Promise<DashboardData | null> {
    try {
      // Return cached data immediately if available (stale-while-revalidate pattern could be implemented in hook, 
      // but here we just ensure we set the cache after fetch)
      // Note: The hook useDashboard might handle the 'read cache first' logic. 
      // Let's ensure we just cache the result here.
      
      const result = await callFunction<DashboardData>("get_dashboard", { uid: auth.currentUser?.uid });

      if (result) {
        CacheUtils.set(CACHE_KEY, result, CACHE_TTL);
        return result;
      }
      return null;
    } catch (err) {
      console.error("Fetch dashboard failed", err);
      throw err;
    }
  }

  static getCachedDashboard(): DashboardData | null {
    return CacheUtils.get<DashboardData>(CACHE_KEY);
  }
}
