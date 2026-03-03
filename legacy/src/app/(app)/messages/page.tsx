"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { callFunction } from "@/lib/cloudbase";
import { useAuth } from "@/providers/AuthProvider";
import { useCouple } from "@/providers/CoupleProvider";
import { useToast } from "@/providers/ToastProvider";
import { formatDateTime } from "@/utils/date";

const PAGE_SIZE = 20;

export default function MessagesPage() {
  const { user } = useAuth();
  const { role, coupleId } = useCouple();
  const { pushToast } = useToast();
  const [messages, setMessages] = useState<any[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const fetchMessages = async (reset = false) => {
    if (!coupleId) return;
    setLoading(true);
    const offset = reset ? 0 : page * PAGE_SIZE;
    try {
      const data = await callFunction<any[]>("manage_message", {
        action: "list",
        data: { offset, limit: PAGE_SIZE },
      });

      const mapped = data.map((item: any) => ({
        ...item,
        nickname: item.profile?.[0]?.nickname ?? "对方",
      }));

      if (reset) {
        setMessages(mapped);
        setPage(1);
      } else {
        setMessages((prev) => [...prev, ...mapped]);
        setPage((prev) => prev + 1);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载留言失败";
      pushToast(message || "加载留言失败", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages(true);
  }, [coupleId]);

  const handleSend = async () => {
    if (!content.trim()) {
      pushToast("请输入留言内容", "error");
      return;
    }
    if (!coupleId || !user) {
      pushToast("未找到情侣空间信息", "error");
      return;
    }

    try {
      await callFunction("manage_message", {
        action: "create",
        data: {
          content: content.trim(),
        },
      });

      pushToast("留言已发送", "success");
      setContent("");
      fetchMessages(true);
    } catch (error: any) {
      pushToast(error.message || "发送失败", "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await callFunction("manage_message", {
        action: "delete",
        data: { id },
      });

      pushToast("已删除", "success");
      fetchMessages(true);
    } catch (error: any) {
      pushToast(error.message || "删除失败", "error");
    }
  };

  return (
    <div>
      <TopBar title="留言板" />
      <div className="page">
        <div className="card">
          <div className="form">
            <label>
              <div className="form-label">新的留言</div>
              <textarea
                className="textarea"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="说点温柔的话"
              />
            </label>
            <button className="btn" onClick={handleSend}>
              发送留言
            </button>
          </div>
        </div>

        <div className="list" style={{ marginTop: 16 }}>
          {messages.map((msg) => (
            <div key={msg._id} className="list-item">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{msg.nickname ?? "对方"}</strong>
                {(role === "reviewer" || msg.created_by === user?.uid) && (
                  <button className="btn ghost" onClick={() => handleDelete(msg._id)}>
                    删除
                  </button>
                )}
              </div>
              <div>{msg.content}</div>
              <div className="card-muted">{formatDateTime(msg.created_at)}</div>
            </div>
          ))}
          {!loading && messages.length === 0 ? <div className="card-muted">暂无留言</div> : null}
        </div>

        <button className="btn secondary" style={{ marginTop: 16 }} onClick={() => fetchMessages()} disabled={loading}>
          {loading ? "加载中…" : "加载更多"}
        </button>
      </div>
    </div>
  );
}
