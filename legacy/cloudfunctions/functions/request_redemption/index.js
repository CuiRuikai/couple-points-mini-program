const { cloudbase } = require("./utils");
const db = cloudbase.database();
const $ = db.command.aggregate;
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

function isRewardActive(reward) {
  const raw = reward && (reward.active ?? reward.is_active);
  if (raw === undefined || raw === null) return true;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  if (typeof raw === "string") {
    const value = raw.trim().toLowerCase();
    return value !== "" && value !== "0" && value !== "false" && value !== "inactive";
  }
  return Boolean(raw);
}

exports.main = async (event, context) => {
  const uid =
    (event.userInfo && (event.userInfo.openId || event.userInfo.uuid)) ||
    (context && context.auth && context.auth.uid) ||
    (typeof event.uid === "string" ? event.uid.trim() : "");
  const rewardId = typeof event.reward_id === "string"
    ? event.reward_id.trim()
    : String(event.reward_id || "").trim();

  if (!uid) throw new Error("Unauthorized");
  if (!rewardId) throw new Error("reward_id is required");

  const redemptionId = await db.runTransaction(async (transaction) => {
    const memberRes = await transaction.collection("CoupleMember").where({ user_id: uid }).get();
    if (memberRes.data.length === 0) throw new Error("Not in a couple");
    const member = memberRes.data[0];
    if (member.role !== "earner") throw new Error("Only earner can redeem");

    const rewardRes = await transaction.collection("Reward").where({ _id: rewardId }).limit(1).get();
    const reward = rewardRes.data[0];
    const sameCouple = String(reward?.couple_id ?? "") === String(member.couple_id ?? "");
    if (!reward || !sameCouple || !isRewardActive(reward)) {
      throw new Error("Reward not found or inactive");
    }

    const costPoints = Number(reward.cost_points);
    if (!Number.isFinite(costPoints) || costPoints <= 0) {
      throw new Error("Invalid reward cost");
    }

    const balanceRes = await transaction.collection("Transaction")
      .aggregate()
      .match({ couple_id: member.couple_id })
      .group({
        _id: null,
        balance: $.sum($.ifNull(["$points_final", "$points_suggested"])),
      })
      .end();

    const balance = balanceRes.data[0]?.balance || 0;
    if (balance < costPoints) throw new Error("Insufficient balance");

    const now = new Date().toISOString();
    const redRes = await transaction.collection("Redemption").add({
      couple_id: member.couple_id,
      reward_id: rewardId,
      created_by: uid,
      created_at: now,
    });

    const createdRedemptionId = redRes.id;

    await transaction.collection("Transaction").add({
      couple_id: member.couple_id,
      type: "redemption",
      title: reward.title,
      note: "奖励兑换扣分",
      points_suggested: -costPoints,
      points_final: -costPoints,
      created_by: uid,
      created_at: now,
      event_date: toBeijingDateString(new Date()),
      redemption_id: createdRedemptionId,
    });

    await transaction.collection("Reward").doc(rewardId).update({
      redeemed_count: (Number(reward.redeemed_count) || 0) + 1,
      updated_at: now,
    });

    return createdRedemptionId;
  });

  return { redemption_id: redemptionId };
};
