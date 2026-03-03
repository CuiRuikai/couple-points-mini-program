const { cloudbase } = require("./utils");
const db = cloudbase.database();

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

  const useId = await db.runTransaction(async (transaction) => {
    const memberRes = await transaction.collection("CoupleMember").where({ user_id: uid }).get();
    if (memberRes.data.length === 0) throw new Error("Not in a couple");
    const member = memberRes.data[0];
    if (member.role !== "earner") throw new Error("Only earner can use rewards");

    const rewardRes = await transaction.collection("Reward").where({ _id: rewardId }).limit(1).get();
    const reward = rewardRes.data[0];
    const sameCouple = String(reward?.couple_id ?? "") === String(member.couple_id ?? "");
    if (!reward || !sameCouple || !isRewardActive(reward)) {
      throw new Error("Reward not found or inactive");
    }

    let available;
    const redeemedCount = Number(reward.redeemed_count);
    const usedCount = Number(reward.used_count);
    const hasCounters = Number.isFinite(redeemedCount) && Number.isFinite(usedCount);

    if (hasCounters) {
      available = redeemedCount - usedCount;
    } else {
      const [redeemedCountRes, usedCountRes] = await Promise.all([
        transaction.collection("Redemption")
          .where({ couple_id: member.couple_id, reward_id: rewardId })
          .count(),
        transaction.collection("RewardUsage")
          .where({ couple_id: member.couple_id, reward_id: rewardId })
          .count(),
      ]);
      available = redeemedCountRes.total - usedCountRes.total;
    }

    if (available < 1) throw new Error("No available reward usage");

    const now = new Date().toISOString();
    const useRes = await transaction.collection("RewardUsage").add({
      couple_id: member.couple_id,
      reward_id: rewardId,
      created_by: uid,
      created_at: now,
      used_at: now,
    });

    await transaction.collection("Reward").doc(rewardId).update({
      used_count: (Number(reward.used_count) || 0) + 1,
      updated_at: now,
    });

    return useRes.id;
  });

  return { use_id: useId };
};
