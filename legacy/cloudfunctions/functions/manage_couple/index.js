const { cloudbase } = require("./utils");
const db = cloudbase.database();

exports.main = async (event, context) => {
  const uid = (event.userInfo && (event.userInfo.openId || event.userInfo.uuid)) ||
              (context && context.auth && context.auth.uid) ||
              (typeof event.uid === "string" ? event.uid.trim() : "");

  if (!uid) throw new Error("Unauthorized");

  const memberRes = await db.collection("CoupleMember").where({ user_id: uid }).get();
  if (memberRes.data.length === 0) throw new Error("Not in a couple");
  const coupleId = memberRes.data[0].couple_id;

  const { action, data } = event;

  switch (action) {
    case "update_anniversary":
      const { date } = data;
      if (!date) throw new Error("Date is required");
      
      await db.collection("Couple").doc(coupleId).update({
        anniversary_date: date
      });
      return { success: true };
      
    default:
        throw new Error(`Unknown action: ${action}`);
  }
};
