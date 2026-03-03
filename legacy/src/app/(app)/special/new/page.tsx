"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { useCouple } from "@/providers/CoupleProvider";
import { useToast } from "@/providers/ToastProvider";
import { auth, callFunction } from "@/lib/cloudbase";
import { toISODate } from "@/utils/date";

export default function SpecialNewPage() {
  const router = useRouter();
  const { role } = useCouple();
  const { pushToast } = useToast();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [points, setPoints] = useState("");
  const [eventDate, setEventDate] = useState(toISODate(new Date()));
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      pushToast("标题不能为空", "error");
      return;
    }

    setLoading(true);

    const pointsValue = points ? Number(points) : null;
    try {
      await callFunction("submit_special", {
        title: title.trim(),
        note: note.trim() || null,
        points_suggested: Number.isFinite(pointsValue) ? pointsValue : null,
        event_date: eventDate,
        uid: auth.currentUser?.uid,
      });

      pushToast("已提交特殊事件", "success");
      router.replace("/ledger");
    } catch (error: any) {
      pushToast(error.message || "提交失败", "error");
    } finally {
      setLoading(false);
    }
  };

  if (role !== "earner") {
    return (
      <div>
        <TopBar title="提交特殊事件" back />
        <div className="page">
          <div className="card">仅小鸡毛可以提交特殊事件。</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="提交特殊事件" back />
      <div className="page">
        <form className="card form" onSubmit={handleSubmit}>
          <label>
            <div className="form-label">标题</div>
            <input
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="今天做了什么特别的事"
              required
            />
          </label>
          <label>
            <div className="form-label">描述</div>
            <textarea
              className="textarea"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="补充说明（可选）"
            />
          </label>
          <label>
            <div className="form-label">建议分值</div>
            <input
              className="input"
              type="number"
              value={points}
              onChange={(event) => setPoints(event.target.value)}
              placeholder="可正可负"
            />
          </label>
          <label>
            <div className="form-label">发生日期</div>
            <input
              className="input"
              type="date"
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
            />
          </label>
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "提交中…" : "提交"}
          </button>
        </form>
      </div>
    </div>
  );
}
