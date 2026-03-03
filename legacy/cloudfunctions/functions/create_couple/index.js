const { cloudbase, success, error } = require("./utils");
const db = cloudbase.database();

exports.main = async (event, context) => {
  // Get UID from various possible sources
  const uid = (event.userInfo && (event.userInfo.openId || event.userInfo.uuid)) ||
              (context && context.auth && context.auth.uid) ||
              (typeof event.uid === "string" ? event.uid.trim() : "");

  const { role } = event;

  if (!uid) {
    return error("Unauthorized: Missing user identity", 401);
  }

  if (!["earner", "reviewer"].includes(role)) {
    return error("Invalid role", 400);
  }

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Check if already in a couple
      const memberRes = await transaction.collection("CoupleMember").where({ user_id: uid }).get();
      if (memberRes.data.length > 0) throw new Error("Already in a couple");

      // Generate invite code with collision check
      let inviteCode = null;
      for (let i = 0; i < 6; i += 1) {
        const candidate = Math.random().toString(36).substring(2, 10).toUpperCase();
        const existing = await transaction.collection("Couple").where({ invite_code: candidate }).limit(1).get();
        if (existing.data.length === 0) {
          inviteCode = candidate;
          break;
        }
      }

      if (!inviteCode) throw new Error("Generate invite code failed, please retry");

      // Create couple
      const now = new Date().toISOString();
      const coupleRes = await transaction.collection("Couple").add({
        invite_code: inviteCode,
        created_by: uid,
        created_at: now,
      });

      const coupleId = coupleRes.id;

      // Add member
      await transaction.collection("CoupleMember").add({
        couple_id: coupleId,
        user_id: uid,
        role,
        joined_at: now,
      });

      return { couple_id: coupleId, invite_code: inviteCode };
    });

    return success(result);
  } catch (err) {
    console.error("Create couple failed", err);
    return error(err.message);
  }
};
