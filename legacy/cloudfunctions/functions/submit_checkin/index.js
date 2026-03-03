const { cloudbase } = require("./utils");
const db = cloudbase.database();
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

function getBeijingDateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toBeijingDateString(date);
}

exports.main = async (event, context) => {
  const uid = (event.userInfo && (event.userInfo.openId || event.userInfo.uuid)) ||
              (context && context.auth && context.auth.uid) ||
              (typeof event.uid === "string" ? event.uid.trim() : "");

  const { rule_id, is_makeup, event_date, note } = event;

  if (!uid) throw new Error("Unauthorized: Missing user identity");

  if (!rule_id) throw new Error("rule_id is required");
  if (!event_date) throw new Error("event_date is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
    throw new Error("event_date format must be YYYY-MM-DD");
  }

  const transactionId = await db.runTransaction(async (transaction) => {
    // Get member info
    const memberRes = await transaction.collection("CoupleMember").where({ user_id: uid }).get();
    if (memberRes.data.length === 0) throw new Error("Not in a couple");
    const member = memberRes.data[0];
    if (member.role !== "earner") throw new Error("Only earner can submit checkin");

    // Get rule
    const ruleRes = await transaction.collection("Rule").where({ _id: rule_id }).limit(1).get();
    const rule = ruleRes.data[0];
    if (!rule) {
      throw new Error("Rule not found");
    }
    if (rule.couple_id !== member.couple_id) {
      throw new Error("Rule does not belong to your couple");
    }
    if (!rule.active) {
      throw new Error("Rule inactive");
    }

    let period_start = event_date;
    if (is_makeup) {
      const threeDaysAgo = getBeijingDateOffset(-3);
      const today = toBeijingDateString();
      if (event_date < threeDaysAgo || event_date > today) {
        throw new Error("Makeup only allowed within 3 days");
      }
    }

    // Check for duplicate checkin in the same period
    const existingTxn = await transaction.collection("Transaction").where({
      couple_id: member.couple_id,
      type: "checkin",
      rule_id,
      period_start,
    }).limit(1).get();

    if (existingTxn.data.length > 0) {
      throw new Error("今日已打卡，请勿重复操作");
    }

    const points = Number(rule.points) || 0;
    const txnRes = await transaction.collection("Transaction").add({
      couple_id: member.couple_id,
      type: "checkin",
      title: rule.title,
      note: note || null,
      points_suggested: points,
      points_final: points,
      created_by: uid,
      created_at: new Date().toISOString(),
      event_date,
      is_makeup: !!is_makeup,
      rule_id,
      period_type: "day",
      period_start,
    });

    return txnRes.id;
  });

  return { transaction_id: transactionId };
};
