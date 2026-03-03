"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { auth, callFunction } from "@/lib/cloudbase";
import { useToast } from "@/providers/ToastProvider";
import { formatDateTime, toISODate } from "@/utils/date";
import { formatPoints, formatTxnTypeNote } from "@/utils/format";

const PAGE_SIZE = 20;

export default function LedgerPage() {
  const { pushToast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [type, setType] = useState<string>("");
  const [range, setRange] = useState<string>("7");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchItems = async (reset = false) => {
    setLoading(true);
    const offset = reset ? 0 : page * PAGE_SIZE;
    try {
      let startDate = "";
      if (range) {
        const days = Number(range);
        const start = new Date();
        start.setDate(start.getDate() - days);
        startDate = toISODate(start);
      }

      // 使用云函数获取流水，绕过数据库安全规则限制
      const data = await callFunction<any[]>("get_data", {
        type: "ledger",
        params: {
          offset,
          limit: PAGE_SIZE,
          type,
          start_date: startDate
        },
        uid: auth.currentUser?.uid
      });

      if (reset) {
        setItems(data ?? []);
        setPage(1);
      } else {
        setItems((prev) => [...prev, ...(data ?? [])]);
        setPage((prev) => prev + 1);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载流水失败";
      pushToast(message || "加载流水失败", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems(true);
  }, [type, range]);

  return (
    <div>
      <TopBar title="积分流水" />
      <div className="page">
        <div className="card">
          <div className="form">
            <label>
              <div className="form-label">类型</div>
              <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">全部</option>
                <option value="checkin">打卡</option>
                <option value="special">特殊事件</option>
                <option value="redemption">兑换</option>
              </select>
            </label>
            <label>
              <div className="form-label">时间范围</div>
              <select className="select" value={range} onChange={(e) => setRange(e.target.value)}>
                <option value="7">最近 7 天</option>
                <option value="30">最近 30 天</option>
                <option value="365">最近一年</option>
              </select>
            </label>
          </div>
        </div>

        <div className="list" style={{ marginTop: 16 }}>
          {items.map((item) => (
            <Link key={item._id} href={`/ledger/${item._id}`} className="list-item">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{item.title}</strong>
                <span>{formatPoints(item.points_final ?? item.points_suggested)}</span>
              </div>
              <div className="card-muted">
                {formatTxnTypeNote(item.type, item.note)}
              </div>
              <div className="card-muted">{formatDateTime(item.created_at)}</div>
            </Link>
          ))}
          {!loading && items.length === 0 ? <div className="card-muted">暂无流水</div> : null}
        </div>

        <button className="btn secondary" style={{ marginTop: 16 }} onClick={() => fetchItems()} disabled={loading}>
          {loading ? "加载中…" : "加载更多"}
        </button>
      </div>
    </div>
  );
}
