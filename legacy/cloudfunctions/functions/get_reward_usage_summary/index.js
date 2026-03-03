const { cloudbase } = require("./utils");
const db = cloudbase.database();
exports.main = async (event, context) => {
  const uid =
    (event.userInfo && (event.userInfo.openId || event.userInfo.uuid)) ||
    (context && context.auth && context.auth.uid) ||
    (typeof event.uid === "string" ? event.uid.trim() : "");
  if (!uid) throw new Error("Unauthorized");
  const memberRes = await db.collection("CoupleMember")
    .where({ user_id: uid })
    .limit(1)
    .field({ couple_id: true })
    .get();
  if (memberRes.data.length === 0) throw new Error("Not in a couple");
  const member = memberRes.data[0];
  const coupleId = member.couple_id;

  const rewardsRes = await db.collection("Reward")
    .where({ couple_id: coupleId })
    .orderBy("sort_order", "asc")
    .field({
      _id: true,
      title: true,
      cost_points: true,
      redeemed_count: true,
      used_count: true,
    })
    .get();

  const rewards = rewardsRes.data || [];
  const hasAllCounters = rewards.every((item) =>
    Number.isFinite(Number(item.redeemed_count)) && Number.isFinite(Number(item.used_count))
  );

  let redeemedMap = new Map();
  let usedMap = new Map();

  if (!hasAllCounters && rewards.length > 0) {
    const $ = db.command.aggregate;
    const [redemptionsAggRes, usagesAggRes] = await Promise.all([
      db.collection("Redemption")
        .aggregate()
        .match({ couple_id: coupleId })
        .group({
          _id: "$reward_id",
          count: $.sum(1),
        })
        .end(),
      db.collection("RewardUsage")
        .aggregate()
        .match({ couple_id: coupleId })
        .group({
          _id: "$reward_id",
          count: $.sum(1),
        })
        .end(),
    ]);

    redeemedMap = new Map((redemptionsAggRes.data || []).map((item) => [item._id, Number(item.count) || 0]));
    usedMap = new Map((usagesAggRes.data || []).map((item) => [item._id, Number(item.count) || 0]));
  }

  return rewards.map(r => {
    const fallbackRedeemed = Number(r.redeemed_count) || 0;
    const fallbackUsed = Number(r.used_count) || 0;
    const redeemed = hasAllCounters
      ? fallbackRedeemed
      : (redeemedMap.has(r._id) ? redeemedMap.get(r._id) : fallbackRedeemed);
    const used = hasAllCounters
      ? fallbackUsed
      : (usedMap.has(r._id) ? usedMap.get(r._id) : fallbackUsed);

    return {
      reward_id: r._id,
      title: r.title,
      cost_points: r.cost_points,
      redeemed_count: redeemed,
      used_count: used,
      remaining_count: Math.max(redeemed - used, 0),
    };
  });
};
