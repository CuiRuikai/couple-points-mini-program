const { cloudbase, success, error } = require("./utils");

const db = cloudbase.database();
const _ = db.command;

exports.main = async (event, context) => {
  const uid = (event.userInfo && (event.userInfo.openId || event.userInfo.uuid)) ||
              (context && context.auth && context.auth.uid) ||
              (typeof event.uid === "string" ? event.uid.trim() : "");

  if (!uid) return error("Unauthorized", 401);

  const { action, data = {} } = event;

  try {
    const memberRes = await db.collection("CoupleMember").where({ user_id: uid }).limit(1).get();
    if (memberRes.data.length === 0) return error("Not in a couple", 403);
    const member = memberRes.data[0];
    const coupleId = member.couple_id;

    switch (action) {
      case "list": {
        const offset = Number(data.offset) || 0;
        const limit = Number(data.limit) || 20;
        const res = await db.collection("Message")
          .aggregate()
          .match({ couple_id: coupleId, deleted_at: _.exists(false) })
          .sort({ created_at: -1 })
          .skip(offset)
          .limit(limit)
          .lookup({
            from: "Profile",
            localField: "created_by",
            foreignField: "user_id",
            as: "profile",
          })
          .end();
        return success(res.data || []);
      }

      case "create": {
        const content = (data.content || "").trim();
        if (!content) return error("Content is required", 400);

        const msgRes = await db.collection("Message").add({
          couple_id: coupleId,
          created_by: uid,
          content,
          created_at: new Date().toISOString(),
        });
        return success({ id: msgRes.id });
      }

      case "delete": {
        const messageId = data.id;
        if (!messageId) return error("id is required", 400);

        const msgRes = await db.collection("Message").doc(messageId).get();
        if (msgRes.data.length === 0 || msgRes.data[0].couple_id !== coupleId) {
          return error("Message not found", 404);
        }
        const message = msgRes.data[0];

        if (member.role !== "reviewer" && message.created_by !== uid) {
          return error("Forbidden", 403);
        }

        await db.collection("Message").doc(messageId).update({
          deleted_at: new Date().toISOString(),
          deleted_by: uid,
        });
        return success({ success: true });
      }

      default:
        return error(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    console.error("Manage message failed", err);
    return error(err.message || "Internal error");
  }
};
