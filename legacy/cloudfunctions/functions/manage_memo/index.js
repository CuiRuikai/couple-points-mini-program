const { cloudbase } = require("./utils");

const db = cloudbase.database();

const MAX_TITLE_LENGTH = 120;
const MAX_CONTENT_TEXT_LENGTH = 20000;
const MAX_CONTENT_HTML_LENGTH = 120000;
const ALLOWED_TAGS = new Set(["p", "br", "strong", "em", "ul", "ol", "li", "blockquote"]);

function sanitizeRichHtml(raw) {
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

function stripHtmlToText(value) {
  if (!value) return "";
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|blockquote|div|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstNonEmptyLine(value) {
  if (!value) return "";
  const lines = String(value).split(/\n+/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function validateMaxLength(value, maxLength, fieldName) {
  if (value.length > maxLength) {
    throw new Error(`${fieldName} is too long`);
  }
}

function normalizeCreatePayload(data) {
  const payload = data || {};

  const titleValue = payload.title === undefined ? undefined : String(payload.title).trim();
  const contentValue = payload.content === undefined ? undefined : String(payload.content);
  let contentTextValue = payload.content_text === undefined ? undefined : String(payload.content_text);
  let contentHtmlValue = payload.content_html === undefined ? undefined : sanitizeRichHtml(payload.content_html);

  if (contentHtmlValue !== undefined) {
    validateMaxLength(contentHtmlValue, MAX_CONTENT_HTML_LENGTH, "content_html");
    if (contentTextValue === undefined) {
      contentTextValue = stripHtmlToText(contentHtmlValue);
    }
  }

  if (contentTextValue === undefined && contentValue !== undefined) {
    contentTextValue = String(contentValue);
  }

  const contentTextTrimmed = (contentTextValue || "").trim();
  const fallbackTitle = firstNonEmptyLine(contentTextTrimmed);

  const normalizedTitle = titleValue || fallbackTitle || "新建笔记";
  const normalizedContentText = contentTextValue !== undefined ? contentTextValue : contentTextTrimmed;
  const normalizedContent = contentValue !== undefined ? contentValue : normalizedContentText;

  const hasAnyContent = Boolean(
    normalizedTitle.trim() ||
      String(normalizedContent || "").trim() ||
      String(normalizedContentText || "").trim() ||
      String(contentHtmlValue || "").trim()
  );

  if (!hasAnyContent) {
    throw new Error("Title or content is required");
  }

  validateMaxLength(normalizedTitle, MAX_TITLE_LENGTH, "title");
  validateMaxLength(String(normalizedContentText || ""), MAX_CONTENT_TEXT_LENGTH, "content_text");
  validateMaxLength(String(normalizedContent || ""), MAX_CONTENT_TEXT_LENGTH, "content");

  const output = {
    title: normalizedTitle,
    content: String(normalizedContent || ""),
    content_text: String(normalizedContentText || ""),
  };

  if (contentHtmlValue !== undefined) {
    output.content_html = contentHtmlValue;
    output.editor_version = 2;
  }

  if (payload.editor_version !== undefined) {
    const editorVersion = Number(payload.editor_version);
    if (!Number.isInteger(editorVersion) || editorVersion <= 0) {
      throw new Error("Invalid editor_version");
    }
    output.editor_version = editorVersion;
  }

  return output;
}

function normalizeUpdatePayload(data) {
  const payload = data || {};
  const output = {};

  if (payload.title !== undefined) {
    const nextTitle = String(payload.title).trim();
    validateMaxLength(nextTitle, MAX_TITLE_LENGTH, "title");
    output.title = nextTitle || "新建笔记";
  }

  if (payload.content !== undefined) {
    const nextContent = String(payload.content);
    validateMaxLength(nextContent, MAX_CONTENT_TEXT_LENGTH, "content");
    output.content = nextContent;
    if (payload.content_text === undefined && payload.content_html === undefined) {
      output.content_text = nextContent;
    }
  }

  if (payload.content_text !== undefined) {
    const nextContentText = String(payload.content_text);
    validateMaxLength(nextContentText, MAX_CONTENT_TEXT_LENGTH, "content_text");
    output.content_text = nextContentText;
    if (payload.content === undefined) {
      output.content = nextContentText;
    }
  }

  if (payload.content_html !== undefined) {
    const nextContentHtml = sanitizeRichHtml(payload.content_html);
    validateMaxLength(nextContentHtml, MAX_CONTENT_HTML_LENGTH, "content_html");
    output.content_html = nextContentHtml;
    output.editor_version = 2;

    if (payload.content_text === undefined && payload.content === undefined) {
      const plainText = stripHtmlToText(nextContentHtml);
      validateMaxLength(plainText, MAX_CONTENT_TEXT_LENGTH, "content_text");
      output.content_text = plainText;
      output.content = plainText;
    }
  }

  if (payload.editor_version !== undefined) {
    const editorVersion = Number(payload.editor_version);
    if (!Number.isInteger(editorVersion) || editorVersion <= 0) {
      throw new Error("Invalid editor_version");
    }
    output.editor_version = editorVersion;
  }

  return output;
}

exports.main = async (event, context) => {
  const uid =
    (event.userInfo && (event.userInfo.openId || event.userInfo.uuid)) ||
    (context && context.auth && context.auth.uid) ||
    (typeof event.uid === "string" ? event.uid.trim() : "");

  if (!uid) throw new Error("Unauthorized: Missing user identity");

  const memberRes = await db.collection("CoupleMember").where({ user_id: uid }).get();
  if (memberRes.data.length === 0) throw new Error("Not in a couple");
  const member = memberRes.data[0];
  const coupleId = member.couple_id;

  const { action, data } = event;

  switch (action) {
    case "create_note": {
      const notePayload = normalizeCreatePayload(data);
      const now = new Date().toISOString();

      const res = await db.collection("notes").add({
        couple_id: coupleId,
        ...notePayload,
        created_by: uid,
        created_at: now,
        updated_at: now,
      });
      return { id: res.id };
    }

    case "update_note": {
      const { id } = data || {};
      if (!id) throw new Error("ID is required");

      const note = await db.collection("notes").doc(id).get();
      if (!note.data.length || note.data[0].couple_id !== coupleId) {
        throw new Error("Note not found or permission denied");
      }

      const updatePayload = normalizeUpdatePayload(data);
      if (Object.keys(updatePayload).length === 0) {
        throw new Error("No valid fields to update");
      }

      await db.collection("notes").doc(id).update({
        ...updatePayload,
        updated_at: new Date().toISOString(),
      });
      return { success: true };
    }

    case "delete_note": {
      const { id } = data || {};
      if (!id) throw new Error("ID is required");

      const note = await db.collection("notes").doc(id).get();
      if (!note.data.length || note.data[0].couple_id !== coupleId) {
        throw new Error("Note not found or permission denied");
      }

      await db.collection("notes").doc(id).remove();
      return { success: true };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
