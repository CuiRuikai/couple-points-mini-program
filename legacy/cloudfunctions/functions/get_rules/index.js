const { cloudbase, success, error } = require("./utils");

const db = cloudbase.database();
const ruleFields = {
  _id: true,
  title: true,
  description: true,
  points: true,
  frequency: true,
  active: true,
  sort_order: true,
  created_at: true,
  updated_at: true,
};

exports.main = async (event, context) => {
  const uid = (event.userInfo && (event.userInfo.openId || event.userInfo.uuid)) ||
              (context && context.auth && context.auth.uid) ||
              (typeof event.uid === "string" ? event.uid.trim() : "");

  if (!uid) {
    return error("Unauthorized: Missing user identity", 401);
  }

  const { ruleId } = event;

  try {
    // 1. Get member info to find couple_id
    const memberRes = await db.collection("CoupleMember")
      .where({ user_id: uid })
      .limit(1)
      .field({ couple_id: true, role: true })
      .get();
    if (memberRes.data.length === 0) {
      return success({ rules: [], rule: null });
    }

    const coupleId = memberRes.data[0].couple_id;
    const role = memberRes.data[0].role;

    // 2. Fetch rule(s)
    if (ruleId) {
      const where = { _id: ruleId, couple_id: coupleId };
      if (role !== "reviewer") where.active = true;
      const { data } = await db.collection("Rule")
        .where(where)
        .limit(1)
        .field(ruleFields)
        .get();
      return success({ rule: data.length > 0 ? data[0] : null });
    }

    const where = role === "reviewer"
      ? { couple_id: coupleId }
      : { couple_id: coupleId, active: true };

    const { data } = await db.collection("Rule")
      .where(where)
      .orderBy("sort_order", "asc")
      .field(ruleFields)
      .get();

    return success({ rules: data });
  } catch (err) {
    console.error("Get rules failed", err);
    return error(err.message);
  }
};
