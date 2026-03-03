const { cloudbase, success, error } = require("./utils");
const db = cloudbase.database();

exports.main = async (event, context) => {
  // Get UID from various possible sources
  const uid = (event.userInfo && (event.userInfo.openId || event.userInfo.uuid)) ||
              (context && context.auth && context.auth.uid) ||
              (typeof event.uid === "string" ? event.uid.trim() : "");

  const inviteCode = (event.invite_code || "").trim().toUpperCase();

  if (!uid) {
    return error("Unauthorized: Missing user identity", 401);
  }

  if (!inviteCode) {
    return error("Invite code is required", 400);
  }

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Check if already in a couple
      const memberRes = await transaction.collection("CoupleMember").where({ user_id: uid }).get();
      if (memberRes.data.length > 0) throw new Error("Already in a couple");

      // Find couple
      const coupleRes = await transaction.collection("Couple").where({ invite_code: inviteCode }).limit(1).get();
      if (coupleRes.data.length === 0) throw new Error("Invalid invite code");

      const coupleId = coupleRes.data[0]._id;

      // Check member count and determine role
      const existingMemberRes = await transaction.collection("CoupleMember").where({ couple_id: coupleId }).get();
      if (existingMemberRes.data.length === 0) throw new Error("Couple is unavailable");
      if (existingMemberRes.data.length >= 2) throw new Error("Couple is full");

      const existingRole = existingMemberRes.data[0].role;
      const assignedRole = existingRole === "earner" ? "reviewer" : "earner";

      // Add member
      await transaction.collection("CoupleMember").add({
        couple_id: coupleId,
        user_id: uid,
        role: assignedRole,
        joined_at: new Date().toISOString(),
      });

      return { couple_id: coupleId, role: assignedRole };
    });

    return success(result);
  } catch (err) {
    console.error("Join couple failed", err);
    return error(err.message);
  }
};
