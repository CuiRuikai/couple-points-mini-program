const { cloudbase, success, error } = require("./utils");
const db = cloudbase.database();

exports.main = async (event, context) => {
  const uid = (event.userInfo && (event.userInfo.openId || event.userInfo.uuid)) ||
              (context && context.auth && context.auth.uid) ||
              (typeof event.uid === "string" ? event.uid.trim() : "");

  if (!uid) return success(null);

  const { data } = await db.collection("Profile").where({ user_id: uid }).limit(1).get();
  
  if (data.length > 0) {
      return success(data[0]);
  }
  
  return success(null);
};
