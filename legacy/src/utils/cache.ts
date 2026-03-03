export const CacheUtils = {
  set(key: string, value: any, ttlSeconds: number = 3600) {
    if (typeof window === "undefined") return;
    const item = {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    };
    try {
      localStorage.setItem(key, JSON.stringify(item));
    } catch (e) {
      console.warn("Cache set failed", e);
    }
  },

  get<T>(key: string): T | null {
    if (typeof window === "undefined") return null;
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;

    try {
      const item = JSON.parse(itemStr);
      if (Date.now() > item.expiry) {
        localStorage.removeItem(key);
        return null;
      }
      return item.value as T;
    } catch (e) {
      return null;
    }
  },

  remove(key: string) {
    if (typeof window === "undefined") return;
    localStorage.removeItem(key);
  },
};
