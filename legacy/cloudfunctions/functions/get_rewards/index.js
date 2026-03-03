const { cloudbase } = require("./utils");

const db = cloudbase.database();
const rewardFields = {
  _id: true,
  title: true,
  cost_points: true,
  description: true,
  image_url: true,
  active: true,
  sort_order: true,
  redeemed_count: true,
  used_count: true,
  created_at: true,
  updated_at: true,
};

exports.main = async (event, context) => {
  const uid =
    (event.userInfo && (event.userInfo.openId || event.userInfo.uuid)) ||
    (context && context.auth && context.auth.uid) ||
    (typeof event.uid === "string" ? event.uid.trim() : "");

  if (!uid) {
    throw new Error("Unauthorized: Missing user identity");
  }

  const { rewardId } = event;

  // 1. Get member info
  const memberRes = await db.collection("CoupleMember")
    .where({ user_id: uid })
    .limit(1)
    .field({ couple_id: true, role: true })
    .get();
  if (memberRes.data.length === 0) {
    return { rewards: [], reward: null };
  }

  const coupleId = memberRes.data[0].couple_id;
  const role = memberRes.data[0].role;

  // 2. Fetch reward(s)
  if (rewardId) {
    const where = { _id: rewardId, couple_id: coupleId };
    if (role !== "reviewer") where.active = true;
    const { data } = await db.collection("Reward")
      .where(where)
      .limit(1)
      .field(rewardFields)
      .get();
    return { reward: data.length > 0 ? data[0] : null };
  }

  const where = role === "reviewer"
    ? { couple_id: coupleId }
    : { couple_id: coupleId, active: true };

  const { data } = await db.collection("Reward")
    .where(where)
    .orderBy("sort_order", "asc")
    .field(rewardFields)
    .get();

  if (role === "reviewer") {
    const activeCount = data.filter((item) => item.active).length;
    const inactiveCount = data.length - activeCount;

    const hasCounters = data.every((item) =>
      Number.isFinite(Number(item.redeemed_count)) && Number.isFinite(Number(item.used_count))
    );

    let redeemedCount = 0;
    let usedCount = 0;

    if (hasCounters) {
      redeemedCount = data.reduce((sum, item) => sum + (Number(item.redeemed_count) || 0), 0);
      usedCount = data.reduce((sum, item) => sum + (Number(item.used_count) || 0), 0);
    } else {
      const [redemptionCountRes, usageCountRes] = await Promise.all([
        db.collection("Redemption").where({ couple_id: coupleId }).count(),
        db.collection("RewardUsage").where({ couple_id: coupleId }).count(),
      ]);
      redeemedCount = redemptionCountRes.total || 0;
      usedCount = usageCountRes.total || 0;
    }

    return {
      rewards: data,
      summary: {
        redeemed_count: redeemedCount,
        active_count: activeCount,
        inactive_count: inactiveCount,
        used_count: usedCount
      }
    };
  }

  return { rewards: data, summary: null };
};
