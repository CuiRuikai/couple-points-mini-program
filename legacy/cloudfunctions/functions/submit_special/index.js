const { cloudbase } = require("./utils");
const db = cloudbase.database();

exports.main = async (event, context) => {
  const uid = (event.userInfo && (event.userInfo.openId || event.userInfo.uuid)) ||
              (context && context.auth && context.auth.uid) ||
              (typeof event.uid === "string" ? event.uid.trim() : "");
  const { title, note, points_suggested, event_date } = event;
  if (!uid) throw new Error("Unauthorized");
  if (!title || !title.trim()) throw new Error("Title is required");
  if (!event_date) throw new Error("event_date is required");

  const memberRes = await db.collection("CoupleMember").where({ user_id: uid }).get();
  if (memberRes.data.length === 0) throw new Error("Not in a couple");
  const member = memberRes.data[0];

  const suggested = Number.isFinite(Number(points_suggested)) ? Number(points_suggested) : 0;
  const txnRes = await db.collection("Transaction").add({
    couple_id: member.couple_id,
    type: "special",
    title: title.trim(),
    note: note || null,
    points_suggested: suggested,
    points_final: suggested,
    created_by: uid,
    created_at: new Date().toISOString(),
    event_date,
    is_makeup: false,
  });
  return { transaction_id: txnRes.id };
};
