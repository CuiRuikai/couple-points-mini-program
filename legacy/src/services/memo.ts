import { callFunction } from "@/lib/cloudbase";
import { auth } from "@/lib/cloudbase";

export interface Note {
  _id: string;
  title: string;
  content: string;
  content_html?: string;
  content_text?: string;
  editor_version?: number;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface MemoPayload {
  title?: string;
  content?: string;
  content_html?: string;
  content_text?: string;
  editor_version?: number;
}

export const MemoService = {
  async getNotes() {
    const result = await callFunction<Note[] | { data?: Note[] }>("get_data", {
      type: "memos",
      uid: auth.currentUser?.uid
    });

    // callFunction normally unwraps { data, error } to data.
    // Keep a fallback for legacy responses that still include { data }.
    if (Array.isArray(result)) return result;
    if (result && typeof result === "object" && Array.isArray(result.data)) {
      return result.data;
    }
    return [];
  },

  async getNoteById(id: string) {
    const notes = await MemoService.getNotes();
    return notes.find((note) => note._id === id) || null;
  },

  async createNote(titleOrPayload: string | MemoPayload, content = "") {
    const payload =
      typeof titleOrPayload === "string"
        ? { title: titleOrPayload, content }
        : titleOrPayload;

    return callFunction("manage_memo", {
      action: "create_note",
      data: payload,
      uid: auth.currentUser?.uid
    });
  },

  async updateNote(id: string, titleOrPayload?: string | MemoPayload, content?: string) {
    const payload =
      typeof titleOrPayload === "string" || titleOrPayload === undefined
        ? {
            ...(titleOrPayload !== undefined ? { title: titleOrPayload } : {}),
            ...(content !== undefined ? { content } : {}),
          }
        : titleOrPayload;

    return callFunction("manage_memo", {
      action: "update_note",
      data: { id, ...payload },
      uid: auth.currentUser?.uid
    });
  },

  async deleteNote(id: string) {
    return callFunction("manage_memo", {
      action: "delete_note",
      data: { id },
      uid: auth.currentUser?.uid
    });
  }
};
