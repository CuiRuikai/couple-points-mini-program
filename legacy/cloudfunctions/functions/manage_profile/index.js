const { cloudbase } = require("./utils");
const db = cloudbase.database();

function normalizeQuickOptions(value, fieldName) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }
  const cleaned = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  if (cleaned.length === 0) {
    throw new Error(`${fieldName} must contain at least one item`);
  }
  if (!cleaned.includes("其他")) {
    cleaned.push("其他");
  }
  return Array.from(new Set(cleaned)).slice(0, 12);
}

exports.main = async (event, context) => {
  const uid = (event.userInfo && (event.userInfo.openId || event.userInfo.uuid)) ||
              (context && context.auth && context.auth.uid) ||
              (typeof event.uid === "string" ? event.uid.trim() : "");

  if (!uid) throw new Error("Unauthorized");

  const { action, data } = event;

  // Ensure profile exists
  let profileRes = await db.collection("Profile").where({ user_id: uid }).get();
  if (profileRes.data.length === 0) {
      await db.collection("Profile").add({
          user_id: uid,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
      });
      profileRes = await db.collection("Profile").where({ user_id: uid }).get();
  }
  const profileId = profileRes.data[0]._id;

  switch (action) {
    case "update_profile":
      const {
        nickname,
        avatar_url,
        quick_score_plus_options,
        quick_score_minus_options,
      } = data || {};
      const updateData = {};
      if (nickname !== undefined) updateData.nickname = nickname;
      if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
      const normalizedPlus = normalizeQuickOptions(
        quick_score_plus_options,
        "quick_score_plus_options"
      );
      if (normalizedPlus !== undefined) {
        updateData.quick_score_plus_options = normalizedPlus;
      }
      const normalizedMinus = normalizeQuickOptions(
        quick_score_minus_options,
        "quick_score_minus_options"
      );
      if (normalizedMinus !== undefined) {
        updateData.quick_score_minus_options = normalizedMinus;
      }

      if (Object.keys(updateData).length === 0) {
        return { success: true };
      }
      updateData.updated_at = new Date().toISOString();
      await db.collection("Profile").doc(profileId).update(updateData);
      return { success: true };

    case "upload_avatar":
      const { fileContent, fileName } = data;
      if (!fileContent || !fileName) throw new Error("Missing file content or name");
      
      const uploadRes = await cloudbase.uploadFile({
        cloudPath: `avatars/${uid}_${Date.now()}_${fileName}`,
        fileContent: Buffer.from(fileContent, 'base64')
      });
      
      return { fileID: uploadRes.fileID };
      
    default:
        throw new Error(`Unknown action: ${action}`);
  }
};
