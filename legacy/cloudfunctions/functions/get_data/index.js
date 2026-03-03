const tcb = require("@cloudbase/node-sdk");

const app = tcb.init({
  env: tcb.SYMBOL_CURRENT_ENV,
});
const db = app.database();
const _ = db.command;
const $ = db.command.aggregate;
const BEIJING_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toBeijingDateString(value) {
  const parts = BEIJING_DATE_FORMATTER.formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value || "1970";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}

function normalizeDate(value) {
  if (!value || typeof value !== "string") return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return toBeijingDateString(parsed);
}

function parsePositiveInt(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  const intValue = Math.floor(parsed);
  return Math.min(intValue, max);
}

exports.main = async (event, context) => {
  const uid = (event.userInfo && (event.userInfo.openId || event.userInfo.uuid)) ||
              (context && context.auth && context.auth.uid) ||
              (typeof event.uid === "string" ? event.uid.trim() : "");

  if (!uid) {
    throw new Error("Unauthorized: Missing user identity");
  }

  const { type, id, params = {} } = event;
  const startDate = normalizeDate(params.start_date);
  const endDate = normalizeDate(params.end_date);

  // 1. Get member info
  const memberRes = await db.collection("CoupleMember")
    .where({ user_id: uid })
    .limit(1)
    .field({ couple_id: true })
    .get();
  if (memberRes.data.length === 0) {
    return { data: null };
  }

  const coupleId = memberRes.data[0].couple_id;

  switch (type) {
    case "messages":
      const offset = parsePositiveInt(params.offset, 0, 50000);
      const limit = parsePositiveInt(params.limit, 20, 100);
      const { data: messages } = await db.collection("Message")
        .aggregate()
        .match({ couple_id: coupleId, deleted_at: _.exists(false) })
        .sort({ created_at: -1 })
        .skip(offset)
        .limit(limit)
        .lookup({
          from: "Profile",
          localField: "created_by",
          foreignField: "user_id",
          as: "profile",
        })
        .end();
      return { data: messages };

    case "ledger":
      const lOffset = parsePositiveInt(params.offset, 0, 50000);
      const lLimit = parsePositiveInt(params.limit, 20, 100);
      const ledgerWhere = { couple_id: coupleId };
      if (params.type) ledgerWhere.type = params.type;
      if (startDate && endDate) {
        ledgerWhere.event_date = _.gte(startDate).and(_.lte(endDate));
      } else if (startDate) {
        ledgerWhere.event_date = _.gte(startDate);
      }

      const lQuery = db.collection("Transaction").where(ledgerWhere);
      const { data: ledger } = await lQuery
        .orderBy("event_date", "desc")
        .orderBy("created_at", "desc")
        .skip(lOffset)
        .limit(lLimit)
        .field({
          _id: true,
          type: true,
          title: true,
          note: true,
          points_suggested: true,
          points_final: true,
          event_date: true,
          created_at: true,
          rule_id: true,
          period_type: true,
          period_start: true,
          redemption_id: true,
        })
        .get();
      return { data: ledger };

    case "ledger_stats":
      const lsWhere = { couple_id: coupleId };
      if (startDate && endDate) {
        lsWhere.event_date = _.gte(startDate).and(_.lte(endDate));
      }

      const statsResult = await db.collection("Transaction")
        .aggregate()
        .match(lsWhere)
        .group({
          _id: null,
          income: $.sum(
            $.cond({
              if: $.gt([$.ifNull(["$points_final", "$points_suggested"]), 0]),
              then: $.ifNull(["$points_final", "$points_suggested"]),
              else: 0
            })
          ),
          expense: $.sum(
            $.cond({
              if: $.lt([$.ifNull(["$points_final", "$points_suggested"]), 0]),
              then: $.abs($.ifNull(["$points_final", "$points_suggested"])),
              else: 0
            })
          )
        })
        .end();

      const statsList = statsResult.data || statsResult.list || [];
      return { data: statsList[0] || { income: 0, expense: 0 } };

    case "checkin_stats":
      if (!startDate || !endDate) return { data: [] };
      // Aggregation to get daily counts
      const aggRes = await db.collection("Transaction")
        .aggregate()
        .match({
            couple_id: coupleId,
            type: "checkin",
            event_date: _.gte(startDate).and(_.lte(endDate))
        })
        .group({
            _id: "$event_date",
            count: db.command.aggregate.sum(1)
        })
        .end();
      const dailyCounts = aggRes.data || aggRes.list || [];
      return { data: dailyCounts };

    case "recent_checkins":
      const recentWhere = { couple_id: coupleId, type: "checkin" };
      if (startDate && endDate) {
        recentWhere.event_date = _.gte(startDate).and(_.lte(endDate));
      } else if (startDate) {
        recentWhere.event_date = _.gte(startDate);
      }
      const recentLimit = parsePositiveInt(params.limit, 200, 500);
      const { data: recentCheckins } = await db.collection("Transaction")
        .where(recentWhere)
        .orderBy("event_date", "desc")
        .limit(recentLimit)
        .field({
          _id: true,
          rule_id: true,
          event_date: true,
          period_type: true,
          period_start: true,
        })
        .get();
      return { data: recentCheckins };

    case "memos":
      const notesOffset = parsePositiveInt(params.offset, 0, 50000);
      const notesLimit = parsePositiveInt(params.limit, 200, 500);
      const { data: notes } = await db.collection("notes")
        .where({ couple_id: coupleId })
        .orderBy("updated_at", "desc")
        .orderBy("created_at", "desc")
        .skip(notesOffset)
        .limit(notesLimit)
        .field({
          _id: true,
          title: true,
          content: true,
          content_html: true,
          content_text: true,
          editor_version: true,
          created_at: true,
          updated_at: true,
          created_by: true,
        })
        .get();
      return { data: notes };

    case "transaction_detail":
      if (!id) throw new Error("Missing id");
      const { data: txn } = await db.collection("Transaction").doc(id).get();
      if (!txn.length) return { data: null };
      if (txn[0].couple_id !== coupleId) throw new Error("Transaction not found");
      return { data: txn[0] };

    case "redemption_detail":
      if (!id) throw new Error("Missing id");
      const { data: redemption } = await db.collection("Redemption").doc(id).get();
      if (!redemption.length) return { data: null };
      if (redemption[0].couple_id !== coupleId) throw new Error("Redemption not found");
      return { data: redemption[0] };

    case "checkins":
      const { today } = params;
      if (!today) return { data: [] };
      const { data: checkinList } = await db.collection("Transaction")
        .where({
          couple_id: coupleId,
          type: "checkin",
          period_start: today,
        })
        .field({
          _id: true,
          rule_id: true,
          period_type: true,
          period_start: true,
          event_date: true,
        })
        .get();
      return { data: checkinList };

    default:
      throw new Error(`Unsupported type: ${type}`);
  }
};
