const { cloudbase } = require("./utils");

const db = cloudbase.database();

function sanitizeRuleInput(input, { requireRequired }) {
  const source = input || {};
  const payload = {};

  if (source.title !== undefined) {
    const title = String(source.title).trim();
    if (!title) throw new Error("title is required");
    payload.title = title;
  } else if (requireRequired) {
    throw new Error("title is required");
  }

  if (source.points !== undefined) {
    const points = Number(source.points);
    if (!Number.isFinite(points)) throw new Error("Invalid points");
    payload.points = points;
  } else if (requireRequired) {
    throw new Error("points is required");
  }

  if (source.description !== undefined) {
    payload.description = source.description === null ? null : String(source.description).trim();
  }

  return payload;
}

exports.main = async (event, context) => {
  const uid = (event.userInfo && (event.userInfo.openId || event.userInfo.uuid)) ||
              (context && context.auth && context.auth.uid) ||
              (typeof event.uid === "string" ? event.uid.trim() : "");

  if (!uid) throw new Error("Unauthorized: Missing user identity");

  const { action, ruleId, data } = event;

  const memberRes = await db.collection("CoupleMember").where({ user_id: uid }).get();
  if (memberRes.data.length === 0) throw new Error("User not in a couple");

  const member = memberRes.data[0];
  const coupleId = member.couple_id;

  if (member.role !== "reviewer") {
    throw new Error("Forbidden: Only reviewers can manage rules");
  }

  switch (action) {
    case "create": {
      const payload = sanitizeRuleInput(data, { requireRequired: true });
      const countRes = await db.collection("Rule").where({ couple_id: coupleId }).count();
      return await db.collection("Rule").add({
        ...payload,
        frequency: "day",
        couple_id: coupleId,
        created_by: uid,
        sort_order: countRes.total,
        active: true,
        created_at: new Date().toISOString(),
      });
    }

    case "update": {
      if (!ruleId) throw new Error("Missing ruleId");
      const existingRule = await db.collection("Rule").doc(ruleId).get();
      if (existingRule.data.length === 0 || existingRule.data[0].couple_id !== coupleId) {
        throw new Error("Rule not found");
      }

      const payload = sanitizeRuleInput(data, { requireRequired: false });
      if (Object.keys(payload).length === 0) throw new Error("No valid fields to update");

      return await db.collection("Rule").doc(ruleId).update({
        ...payload,
        frequency: "day",
        updated_at: new Date().toISOString(),
      });
    }

    case "toggle_active": {
      if (!ruleId) throw new Error("Missing ruleId");
      const ruleRes = await db.collection("Rule").doc(ruleId).get();
      if (ruleRes.data.length === 0 || ruleRes.data[0].couple_id !== coupleId) throw new Error("Rule not found");
      return await db.collection("Rule").doc(ruleId).update({
        active: !ruleRes.data[0].active,
        updated_at: new Date().toISOString(),
      });
    }

    case "delete": {
      if (!ruleId) throw new Error("Missing ruleId");
      const deleteRuleRes = await db.collection("Rule").doc(ruleId).get();
      if (deleteRuleRes.data.length === 0 || deleteRuleRes.data[0].couple_id !== coupleId) {
        throw new Error("Rule not found");
      }
      return await db.collection("Rule").doc(ruleId).remove();
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
};
