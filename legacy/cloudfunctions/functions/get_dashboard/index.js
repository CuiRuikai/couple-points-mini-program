const { cloudbase, success, error } = require("./utils");

const db = cloudbase.database();
const _ = db.command;
const $ = _.aggregate;
const BEIJING_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toBeijingDateString(value = new Date()) {
  const parts = BEIJING_DATE_FORMATTER.formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value || "1970";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}

exports.main = async (event, context) => {
  // Get UID from various possible sources
  const uid =
    (event.userInfo && (event.userInfo.openId || event.userInfo.uuid)) ||
    (context && context.auth && context.auth.uid) ||
    (typeof event.uid === "string" ? event.uid.trim() : "");

  if (!uid) {
    return error("Unauthorized: Missing user identity", 401);
  }

  // 1. Get member info
  const memberRes = await db
    .collection("CoupleMember")
    .where({ user_id: uid })
    .limit(1)
    .field({ couple_id: true, role: true })
    .get();

  if (memberRes.data.length === 0) {
    return success({ role: null, couple_id: null });
  }

  const member = memberRes.data[0];
  const coupleId = member.couple_id;

  // 2. Parallel queries
  const today = toBeijingDateString();

  const [
    totalDailyRes,
    memberCountRes,
    doneDailyRes,
    balanceRes,
    recentTxnsRes,
    recentMsgsRes,
    coupleRes,
  ] = await Promise.all([
    db.collection("Rule").where({ couple_id: coupleId, frequency: "day", active: true }).count(),
    db.collection("CoupleMember").where({ couple_id: coupleId }).count(),
    db.collection("Transaction").where({
      couple_id: coupleId,
      type: "checkin",
      period_type: "day",
      period_start: today,
    }).count(),
    // Balance calculation
    db.collection("Transaction")
      .aggregate()
      .match({ couple_id: coupleId })
      .group({
        _id: null,
        balance: $.sum($.ifNull(["$points_final", "$points_suggested"])),
      })
      .end(),
    db.collection("Transaction")
      .where({ couple_id: coupleId })
      .orderBy("event_date", "desc")
      .orderBy("created_at", "desc")
      .limit(5)
      .field({
        _id: true,
        type: true,
        title: true,
        note: true,
        points_suggested: true,
        points_final: true,
        created_by: true,
        created_at: true,
        event_date: true,
        rule_id: true,
        period_type: true,
        period_start: true,
        redemption_id: true,
      })
      .get(),
    db.collection("Message")
      .aggregate()
      .match({ couple_id: coupleId, deleted_at: _.exists(false) })
      .sort({ created_at: -1 })
      .limit(5)
      .lookup({
        from: "Profile",
        localField: "created_by",
        foreignField: "user_id",
        as: "profile",
      })
      .end(),
    db.collection("Couple")
      .doc(coupleId)
      .field({ anniversary_date: true })
      .get(),
  ]);

  return success({
    role: member.role,
    couple_id: coupleId,
    anniversary_date: coupleRes.data[0]?.anniversary_date,
    member_count: memberCountRes.total,
    balance: balanceRes.data[0]?.balance || 0,
    total_rules_daily: totalDailyRes.total,
    done_daily: doneDailyRes.total,
    recent_transactions: recentTxnsRes.data,
    recent_messages: recentMsgsRes.data.map(m => ({
      ...m,
      nickname: m.profile[0]?.nickname || "未知用户"
    })),
  });
};
