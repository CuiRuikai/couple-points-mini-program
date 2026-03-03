"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { MemoPayload, MemoService } from "@/services/memo";
import { useToast } from "@/providers/ToastProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useCouple } from "@/providers/CoupleProvider";
import { getUserErrorMessage } from "@/utils/error";
import {
  deriveMemoTitle,
  getMemoDraftKey,
  getMemoPreviewText,
  plainTextToMemoHtml,
  stripMemoHtmlToText,
} from "@/utils/memo";

type SaveState = "idle" | "saving" | "saved" | "error";

type DraftData = {
  title?: string;
  content_html?: string;
  content_text?: string;
  saved_at?: string;
};

const ALLOWED_TAGS = new Set(["p", "br", "strong", "em", "ul", "ol", "li", "blockquote"]);

function sanitizeMemoHtml(raw: string): string {
  if (!raw) return "";

  let html = String(raw)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<div(\s[^>]*)?>/gi, "<p>")
    .replace(/<\/div>/gi, "</p>");

  html = html.replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (tagText, tagName) => {
    const lower = String(tagName).toLowerCase();

    if (lower === "b") return tagText.startsWith("</") ? "</strong>" : "<strong>";
    if (lower === "i") return tagText.startsWith("</") ? "</em>" : "<em>";

    if (!ALLOWED_TAGS.has(lower)) {
      return "";
    }

    if (tagText.startsWith("</")) return `</${lower}>`;
    return lower === "br" ? "<br>" : `<${lower}>`;
  });

  return html.trim();
}

function buildPayload(titleValue: string, htmlValue: string): MemoPayload {
  const contentHtml = sanitizeMemoHtml(htmlValue);
  const contentText = stripMemoHtmlToText(contentHtml);
  const normalizedTitle = deriveMemoTitle(titleValue, contentText);

  return {
    title: normalizedTitle,
    content: contentText,
    content_text: contentText,
    content_html: contentHtml,
    editor_version: 2,
  };
}

function getPayloadSignature(payload: MemoPayload): string {
  return JSON.stringify({
    title: payload.title || "",
    content: payload.content || "",
    content_text: payload.content_text || "",
    content_html: payload.content_html || "",
    editor_version: payload.editor_version || 0,
  });
}

export default function MemoEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useToast();
  const { user } = useAuth();
  const { coupleId } = useCouple();

  const noteId = searchParams.get("id")?.trim() || "";
  const isEditing = Boolean(noteId);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [editorHtml, setEditorHtml] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [savedSignature, setSavedSignature] = useState("");
  const [cloudSaveState, setCloudSaveState] = useState<SaveState>("idle");
  const [draftSaveState, setDraftSaveState] = useState<SaveState>("idle");

  const saveRequestRef = useRef(0);
  const autoSaveNotifiedRef = useRef(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const draftKey = useMemo(() => getMemoDraftKey(user?.uid, coupleId), [coupleId, user?.uid]);

  const currentPayload = useMemo(() => buildPayload(title, editorHtml), [title, editorHtml]);
  const currentSignature = useMemo(() => getPayloadSignature(currentPayload), [currentPayload]);
  const hasEditorContent = useMemo(
    () => Boolean(title.trim() || (currentPayload.content_text || "").trim()),
    [currentPayload.content_text, title]
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!initialized) return false;
    if (isEditing) return currentSignature !== savedSignature;
    return hasEditorContent;
  }, [currentSignature, hasEditorContent, initialized, isEditing, savedSignature]);

  const backToMemoList = useCallback(() => {
    router.push("/memo");
  }, [router]);

  const persistEdit = useCallback(
    async (payload: MemoPayload, signature: string) => {
      if (!noteId) return;

      const requestId = ++saveRequestRef.current;
      try {
        await MemoService.updateNote(noteId, payload);
        if (requestId !== saveRequestRef.current) return;
        setSavedSignature(signature);
        setCloudSaveState("saved");
        autoSaveNotifiedRef.current = false;
      } catch (error) {
        if (requestId !== saveRequestRef.current) return;
        setCloudSaveState("error");

        if (!autoSaveNotifiedRef.current) {
          pushToast(getUserErrorMessage(error, "自动保存失败"), "error");
          autoSaveNotifiedRef.current = true;
        }
      }
    },
    [noteId, pushToast]
  );

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setErrorMessage("");
      setInitialized(false);
      setCloudSaveState("idle");
      setDraftSaveState("idle");

      if (isEditing) {
        setLoading(true);
        try {
          const note = await MemoService.getNoteById(noteId);
          if (!note) {
            if (!cancelled) {
              setErrorMessage("未找到笔记");
            }
            return;
          }

          const fallbackText = getMemoPreviewText(note);
          const nextTitle = deriveMemoTitle(note.title, fallbackText);
          const nextHtml = note.content_html?.trim()
            ? sanitizeMemoHtml(note.content_html)
            : plainTextToMemoHtml(note.content_text?.trim() || note.content?.trim() || "");

          if (cancelled) return;
          setTitle(nextTitle);
          setEditorHtml(nextHtml);

          const signature = getPayloadSignature(buildPayload(nextTitle, nextHtml));
          setSavedSignature(signature);
          setCloudSaveState("saved");
        } catch (error) {
          if (cancelled) return;
          setErrorMessage("加载笔记失败");
          pushToast(getUserErrorMessage(error, "加载笔记失败"), "error");
        } finally {
          if (!cancelled) {
            setLoading(false);
            setInitialized(true);
          }
        }
        return;
      }

      setLoading(false);

      let nextTitle = "";
      let nextHtml = "";

      if (draftKey) {
        try {
          const raw = localStorage.getItem(draftKey);
          if (raw) {
            const draft = JSON.parse(raw) as DraftData;
            const fallbackText = draft.content_text || stripMemoHtmlToText(draft.content_html);
            nextTitle = draft.title?.trim() || "";
            nextHtml = draft.content_html?.trim()
              ? sanitizeMemoHtml(draft.content_html)
              : plainTextToMemoHtml(fallbackText || "");
          }
        } catch {
          // ignore broken local draft
        }
      }

      if (cancelled) return;
      setTitle(nextTitle);
      setEditorHtml(nextHtml);
      setSavedSignature("");
      setInitialized(true);
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [draftKey, isEditing, noteId, pushToast]);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== editorHtml) {
      editorRef.current.innerHTML = editorHtml;
    }
  }, [editorHtml]);

  useEffect(() => {
    if (!initialized || loading) return;
    if (isEditing) {
      editorRef.current?.focus();
      return;
    }
    titleInputRef.current?.focus();
  }, [initialized, isEditing, loading]);

  useEffect(() => {
    if (!initialized || !isEditing || !noteId || loading || errorMessage) return;
    if (currentSignature === savedSignature) return;

    setCloudSaveState("saving");
    const timer = window.setTimeout(() => {
      void persistEdit(currentPayload, currentSignature);
    }, 800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    currentPayload,
    currentSignature,
    errorMessage,
    initialized,
    isEditing,
    loading,
    noteId,
    persistEdit,
    savedSignature,
  ]);

  useEffect(() => {
    if (!initialized || isEditing || loading || !draftKey) return;

    if (!hasEditorContent) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // ignore localStorage errors
      }
      setDraftSaveState("idle");
      return;
    }

    setDraftSaveState("saving");
    const timer = window.setTimeout(() => {
      try {
        const draft: DraftData = {
          title: title.trim(),
          content_html: sanitizeMemoHtml(editorHtml),
          content_text: currentPayload.content_text || "",
          saved_at: new Date().toISOString(),
        };
        localStorage.setItem(draftKey, JSON.stringify(draft));
        setDraftSaveState("saved");
      } catch {
        setDraftSaveState("error");
      }
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    currentPayload.content_text,
    draftKey,
    editorHtml,
    hasEditorContent,
    initialized,
    isEditing,
    loading,
    title,
  ]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const handlePastePlainText = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const plainText = event.clipboardData.getData("text/plain");
    if (!plainText) return;
    document.execCommand("insertText", false, plainText);
    setEditorHtml(editorRef.current?.innerHTML || "");
  }, []);

  const confirmLeave = useCallback(() => {
    if (!hasUnsavedChanges) return true;
    return window.confirm("存在未保存内容，确认离开编辑页？");
  }, [hasUnsavedChanges]);

  const handleBack = useCallback(() => {
    if (!confirmLeave()) return;
    backToMemoList();
  }, [backToMemoList, confirmLeave]);

  const handleDone = useCallback(async () => {
    if (submitting || loading || errorMessage) return;

    if (isEditing) {
      if (currentSignature === savedSignature) {
        backToMemoList();
        return;
      }

      setSubmitting(true);
      setCloudSaveState("saving");
      try {
        await MemoService.updateNote(noteId, currentPayload);
        setSavedSignature(currentSignature);
        setCloudSaveState("saved");
        pushToast("保存成功", "success");
        backToMemoList();
      } catch (error) {
        setCloudSaveState("error");
        pushToast(getUserErrorMessage(error, "保存失败"), "error");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!hasEditorContent) {
      if (draftKey) {
        try {
          localStorage.removeItem(draftKey);
        } catch {
          // ignore localStorage errors
        }
      }
      backToMemoList();
      return;
    }

    setSubmitting(true);
    try {
      await MemoService.createNote(currentPayload);
      if (draftKey) {
        try {
          localStorage.removeItem(draftKey);
        } catch {
          // ignore localStorage errors
        }
      }
      setDraftSaveState("idle");
      pushToast("创建成功", "success");
      backToMemoList();
    } catch (error) {
      pushToast(getUserErrorMessage(error, "创建失败"), "error");
    } finally {
      setSubmitting(false);
    }
  }, [
    backToMemoList,
    currentPayload,
    currentSignature,
    draftKey,
    errorMessage,
    hasEditorContent,
    isEditing,
    loading,
    noteId,
    pushToast,
    savedSignature,
    submitting,
  ]);

  const handleDelete = useCallback(async () => {
    if (!isEditing || !noteId || submitting) return;
    if (!window.confirm("确认删除这条笔记？")) return;

    setSubmitting(true);
    try {
      await MemoService.deleteNote(noteId);
      pushToast("删除成功", "success");
      backToMemoList();
    } catch (error) {
      pushToast(getUserErrorMessage(error, "删除失败"), "error");
    } finally {
      setSubmitting(false);
    }
  }, [backToMemoList, isEditing, noteId, pushToast, submitting]);

  const saveStatusText = useMemo(() => {
    if (isEditing) {
      switch (cloudSaveState) {
        case "saving":
          return "保存中…";
        case "saved":
          return "已保存";
        case "error":
          return "保存失败";
        default:
          return "编辑中";
      }
    }

    switch (draftSaveState) {
      case "saving":
        return "草稿保存中…";
      case "saved":
        return "草稿已保存";
      case "error":
        return "草稿保存失败";
      default:
        return "未保存草稿";
    }
  }, [cloudSaveState, draftSaveState, isEditing]);

  return (
    <div>
      <TopBar
        title={isEditing ? "编辑笔记" : "新建笔记"}
        back
        onBack={handleBack}
        rightAction={{
          label: submitting ? "处理中…" : "完成",
          onClick: () => {
            void handleDone();
          },
          disabled: submitting || loading || Boolean(errorMessage),
        }}
      />

      <div className="memo-editor-page">
        {loading ? (
          <div className="card memo-editor-status-card">正在加载…</div>
        ) : errorMessage ? (
          <div className="card memo-editor-status-card">{errorMessage}</div>
        ) : (
          <>
            <div className="memo-editor-surface">
              <input
                ref={titleInputRef}
                className="memo-editor-title-input"
                placeholder="标题"
                value={title}
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
              />

              <div
                ref={editorRef}
                className="memo-editor-body"
                contentEditable
                suppressContentEditableWarning
                data-placeholder="开始记录…"
                onInput={() => setEditorHtml(editorRef.current?.innerHTML || "")}
                onPaste={handlePastePlainText}
              />
            </div>

            {isEditing ? (
              <button
                type="button"
                className="btn ghost memo-editor-delete"
                onClick={() => {
                  void handleDelete();
                }}
                disabled={submitting}
              >
                删除笔记
              </button>
            ) : null}

            <div className="memo-editor-status-row">
              <span
                className={`badge gray memo-editor-save-badge ${
                  cloudSaveState === "error" || draftSaveState === "error" ? "is-error" : ""
                }`}
              >
                {saveStatusText}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
