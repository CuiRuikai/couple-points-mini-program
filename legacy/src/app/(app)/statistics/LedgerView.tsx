"use client";

import { useEffect, useState, useRef } from "react";
import { callFunction } from "@/lib/cloudbase";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { formatPoints, formatTxnTypeNote } from "@/utils/format";

export default function LedgerView() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [stats, setStats] = useState({ income: 0, expense: 0 });

  // Pagination state
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const loaderRef = useRef<HTMLDivElement>(null);
  const lastLoadErrorAt = useRef(0);

  const notifyLoadError = (error: unknown) => {
    const now = Date.now();
    if (now - lastLoadErrorAt.current < 3000) return;
    const message = error instanceof Error ? error.message : "加载流水失败";
    pushToast(message || "加载流水失败", "error");
    lastLoadErrorAt.current = now;
  };

  // 1. Initial Load (Stats + First Page)
  useEffect(() => {
    if (!user?.uid) return;

    const init = async () => {
      setLoading(true);
      setTransactions([]);
      offsetRef.current = 0;
      setHasMore(true);
      setStats({ income: 0, expense: 0 });

      const [y, m] = month.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const start = `${month}-01`;
      const end = `${month}-${String(lastDay).padStart(2, "0")}`;

      try {
        const [statsRes, listRes] = await Promise.all([
          callFunction<any>("get_data", {
            type: "ledger_stats",
            uid: user.uid,
            params: { start_date: start, end_date: end },
          }),
          callFunction<any[]>("get_data", {
            type: "ledger",
            uid: user.uid,
            params: {
              start_date: start,
              end_date: end,
              limit: 20,
              offset: 0,
            },
          }),
        ]);

        setStats(statsRes || { income: 0, expense: 0 });

        const list = Array.isArray(listRes) ? listRes : [];
        setTransactions(list);
        offsetRef.current = list.length;
        if (list.length < 20) setHasMore(false);
      } catch (err) {
        notifyLoadError(err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [month, user?.uid]);

  // 2. Load More Function
  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const start = `${month}-01`;
    const end = `${month}-${String(lastDay).padStart(2, "0")}`;

    try {
      const res = await callFunction<any[]>("get_data", {
        type: "ledger",
        uid: user?.uid,
        params: {
          start_date: start,
          end_date: end,
          limit: 20,
          offset: offsetRef.current,
        },
      });

      const list = Array.isArray(res) ? res : [];
      if (list.length > 0) {
        setTransactions((prev) => [...prev, ...list]);
        offsetRef.current += list.length;
      }
      if (list.length < 20) setHasMore(false);
    } catch (err) {
      notifyLoadError(err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentLoader = loaderRef.current;
    if (currentLoader) {
      observer.observe(currentLoader);
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
    };
  }, [loading, hasMore, month]); // Re-bind when state changes

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="input"
            style={{ width: "auto" }}
          />
          <div className="card-muted">
            收入:{" "}
            <span style={{ color: "var(--success)" }}>+{stats.income}</span>{" "}
            支出:{" "}
            <span style={{ color: "var(--danger)" }}>-{stats.expense}</span>
          </div>
        </div>
      </div>

      <div className="list">
        {transactions.map((item) => (
          <div key={item._id} className="list-item">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{item.title}</strong>
              <span
                style={{
                  color:
                    (item.points_final ?? item.points_suggested) > 0
                      ? "var(--success)"
                      : "var(--danger)",
                }}
              >
                {formatPoints(item.points_final ?? item.points_suggested)}
              </span>
            </div>
            <div className="card-muted">
              {formatTxnTypeNote(item.type, item.note)}
            </div>
          </div>
        ))}

        {/* Load More Sentinel */}
        {hasMore && (
          <div
            ref={loaderRef}
            className="card-muted centered"
            style={{ padding: "16px 0", fontSize: 12, textAlign: "center" }}
          >
            {loading ? "加载中..." : "加载更多..."}
          </div>
        )}

        {!hasMore && transactions.length > 0 && (
          <div className="card-muted centered" style={{ padding: "16px 0", fontSize: 12, textAlign: "center" }}>
            没有更多了
          </div>
        )}

        {transactions.length === 0 && !loading && (
          <div className="card-muted centered">本月无记录</div>
        )}
      </div>
    </div>
  );
}
