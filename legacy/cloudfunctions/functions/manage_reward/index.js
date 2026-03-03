const { cloudbase } = require("./utils");

const db = cloudbase.database();

function sanitizeRewardInput(input, { requireRequired }) {
  const source = input || {};
  const payload = {};

  if (source.title !== undefined) {
    const title = String(source.title).trim();
    if (!title) throw new Error("title is required");
    payload.title = title;
  } else if (requireRequired) {
    throw new Error("title is required");
  }

  if (source.cost_points !== undefined) {
    const costPoints = Number(source.cost_points);
    if (!Number.isFinite(costPoints)) throw new Error("Invalid cost_points");
    payload.cost_points = costPoints;
  } else if (requireRequired) {
    throw new Error("cost_points is required");
  }

  if (source.description !== undefined) {
    payload.description = source.description === null ? null : String(source.description).trim();
  }

  if (source.image_url !== undefined) {
    if (source.image_url === null) {
      payload.image_url = null;
    } else {
      const imageUrl = String(source.image_url).trim();
      payload.image_url = imageUrl || null;
    }
  }

  return payload;
}

exports.main = async (event, context) => {
  const uid =
    (event.userInfo && (event.userInfo.openId || event.userInfo.uuid)) ||
    (context && context.auth && context.auth.uid) ||
    (typeof event.uid === "string" ? event.uid.trim() : "");

  if (!uid) throw new Error("Unauthorized: Missing user identity");

  const { action, rewardId, data } = event;

  const memberRes = await db.collection("CoupleMember").where({ user_id: uid }).get();
  if (memberRes.data.length === 0) throw new Error("User not in a couple");

  const member = memberRes.data[0];
  const coupleId = member.couple_id;

  if (member.role !== "reviewer") {
    throw new Error("Forbidden: Only reviewers can manage rewards");
  }

  switch (action) {
    case "create": {
      const payload = sanitizeRewardInput(data, { requireRequired: true });
      const countRes = await db.collection("Reward").where({ couple_id: coupleId }).count();
      return await db.collection("Reward").add({
        ...payload,
        couple_id: coupleId,
        created_by: uid,
        sort_order: countRes.total,
        active: true,
        redeemed_count: 0,
        used_count: 0,
        created_at: new Date().toISOString(),
      });
    }

    case "update": {
      if (!rewardId) throw new Error("Missing rewardId");
      const existingReward = await db.collection("Reward").doc(rewardId).get();
      if (existingReward.data.length === 0 || existingReward.data[0].couple_id !== coupleId) {
        throw new Error("Reward not found");
      }

      const payload = sanitizeRewardInput(data, { requireRequired: false });
      if (Object.keys(payload).length === 0) throw new Error("No valid fields to update");

      return await db.collection("Reward").doc(rewardId).update({
        ...payload,
        updated_at: new Date().toISOString(),
      });
    }

    case "toggle_active": {
      if (!rewardId) throw new Error("Missing rewardId");
      const rewardRes = await db.collection("Reward").doc(rewardId).get();
      if (rewardRes.data.length === 0 || rewardRes.data[0].couple_id !== coupleId) throw new Error("Reward not found");
      return await db.collection("Reward").doc(rewardId).update({
        active: !rewardRes.data[0].active,
        updated_at: new Date().toISOString(),
      });
    }

    case "delete": {
      if (!rewardId) throw new Error("Missing rewardId");
      const deleteRewardRes = await db.collection("Reward").doc(rewardId).get();
      if (deleteRewardRes.data.length === 0 || deleteRewardRes.data[0].couple_id !== coupleId) {
        throw new Error("Reward not found");
      }
      return await db.collection("Reward").doc(rewardId).remove();
    }

    case "upload_image": {
      const { fileContent, fileName } = data || {};
      if (!fileContent || !fileName) throw new Error("Missing file content or name");

      const uploadRes = await cloudbase.uploadFile({
        cloudPath: `rewards/${uid}_${Date.now()}_${fileName}`,
        fileContent: Buffer.from(fileContent, "base64")
      });

      return { fileID: uploadRes.fileID };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
};
