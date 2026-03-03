"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { MemoService, Note } from "@/services/memo";
import { useToast } from "@/providers/ToastProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useCouple } from "@/providers/CoupleProvider";
import { formatDate } from "@/utils/date";
import { getUserErrorMessage } from "@/utils/error";
import { deriveMemoTitle, getMemoDraftKey, getMemoPreviewText } from "@/utils/memo";

export default function MemoPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const { user } = useAuth();
  const { coupleId } = useCouple();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string>("");

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await MemoService.getNotes();
      setNotes(data);
    } catch (error) {
      pushToast(getUserErrorMessage(error, "获取笔记失败"), "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  const refreshDraftState = useCallback(() => {
    const draftKey = getMemoDraftKey(user?.uid, coupleId);
    if (!draftKey) {
      setHasDraft(false);
      setDraftUpdatedAt("");
      return;
    }

    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) {
        setHasDraft(false);
        setDraftUpdatedAt("");
        return;
      }

      const parsed = JSON.parse(raw) as {
        title?: string;
        content_text?: string;
        content_html?: string;
        saved_at?: string;
      };
      const textPreview = getMemoPreviewText(parsed);
      const hasContent = Boolean(parsed.title?.trim() || textPreview.trim());
      setHasDraft(hasContent);
      setDraftUpdatedAt(parsed.saved_at || "");
    } catch {
      setHasDraft(false);
      setDraftUpdatedAt("");
    }
  }, [coupleId, user?.uid]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    refreshDraftState();
  }, [refreshDraftState]);

  useEffect(() => {
    const handleFocus = () => {
      fetchNotes();
      refreshDraftState();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchNotes();
        refreshDraftState();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchNotes, refreshDraftState]);

  return (
    <div>
      <TopBar title="记事本" />
      <div className="page memo-page">
        <div className="card memo-summary-card">
          <div className="section-header">
            <div>
              <div className="card-title memo-summary-title">笔记清单</div>
              <div className="card-muted">记录灵感、计划和日常小事</div>
            </div>
            <span className="badge gray">{loading ? "同步中…" : `${notes.length} 条`}</span>
          </div>
        </div>

        {hasDraft ? (
          <button
            type="button"
            className="memo-item memo-draft-item"
            onClick={() => router.push("/memo/editor?mode=new")}
          >
            <div className="memo-item-head">
              <div className="memo-item-title">继续本地草稿</div>
              <div className="memo-item-time">
                {draftUpdatedAt ? formatDate(draftUpdatedAt).split(" ")[0] : "刚刚"}
              </div>
            </div>
            <div className="memo-item-content">点击继续编辑未完成内容</div>
          </button>
        ) : null}

        <div className="memo-list">
          {notes.map((note) => (
            <button
              type="button"
              key={note._id}
              className="memo-item"
              onClick={() => router.push(`/memo/editor?id=${encodeURIComponent(note._id)}`)}
            >
              <div className="memo-item-head">
                <div className="memo-item-title">
                  {deriveMemoTitle(note.title, getMemoPreviewText(note))}
                </div>
                <div className="memo-item-time">
                  {formatDate(note.updated_at || note.created_at).split(" ")[0]}
                </div>
              </div>
              <div className="memo-item-content">
                {getMemoPreviewText(note) || "无内容"}
              </div>
            </button>
          ))}

          {loading ? <div className="card memo-empty">正在加载笔记…</div> : null}
          {!loading && notes.length === 0 ? <div className="card memo-empty">暂无笔记</div> : null}
        </div>

        <button
          className="memo-fab"
          onClick={() => router.push("/memo/editor?mode=new")}
          aria-label="新建笔记"
        >
          +
        </button>
      </div>
    </div>
  );
}
