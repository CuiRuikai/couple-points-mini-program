export const MEMO_DRAFT_PREFIX = "memo_draft_v2";

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function getMemoDraftKey(uid?: string | null, coupleId?: string | null): string | null {
  const safeUid = uid?.trim();
  const safeCoupleId = coupleId?.trim();
  if (!safeUid || !safeCoupleId) return null;
  return `${MEMO_DRAFT_PREFIX}:${safeUid}:${safeCoupleId}`;
}

export function stripMemoHtmlToText(value?: string | null): string {
  if (!value) return "";
  const text = String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|blockquote|div|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  return decodeBasicEntities(text)
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function plainTextToMemoHtml(value: string): string {
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`);

  return paragraphs.join("");
}

export function getMemoPreviewText(note: {
  content_text?: string | null;
  content?: string | null;
  content_html?: string | null;
}): string {
  const fromText = note.content_text?.trim();
  if (fromText) return fromText;

  const fromContent = note.content?.trim();
  if (fromContent) return fromContent;

  return stripMemoHtmlToText(note.content_html);
}

export function deriveMemoTitle(title?: string | null, fallbackText?: string | null): string {
  const trimmedTitle = title?.trim();
  if (trimmedTitle) return trimmedTitle;

  const firstLine = fallbackText
    ?.split(/\n+/)
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine || "新建笔记";
}
