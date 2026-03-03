"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { callFunction } from "@/lib/cloudbase";
import { TopBar } from "@/components/layout/TopBar";
import { useCouple } from "@/providers/CoupleProvider";
import { useToast } from "@/providers/ToastProvider";
import { clampDateWithinDays, toISODate } from "@/utils/date";
import { useAuth } from "@/providers/AuthProvider";
import { CacheUtils } from "@/utils/cache";
import { getUserErrorMessage } from "@/utils/error";

type BoardTab = "checklist" | "trend";

interface RuleItem {
  _id: string;
  title: string;
  points: number;
  active: boolean;
  description?: string | null;
  sort_order?: number | null;
}

interface CheckinItem {
  rule_id: string;
  period_type: "day";
  period_start: string;
}

interface CheckinStat {
  _id: string;
  count: number;
}

const getRuleStateErrorType = (
  error: unknown
): "rule_unavailable" | "couple_mismatch" | null => {
  const message = getUserErrorMessage(error, "");
  if (message.includes("Rule does not belong to your couple") || message.includes("不属于当前情侣空间")) {
    return "couple_mismatch";
  }
  if (
    message.includes("Rule not found or inactive") ||
    message.includes("Rule not found") ||
    message.includes("Rule inactive") ||
    message.includes("已下架或删除")
  ) {
    return "rule_unavailable";
  }
  return null;
};

export default function CheckinPage() {
  const { role, coupleId, refresh: refreshCouple } = useCouple();
  const { user } = useAuth();
  const { pushToast } = useToast();

  const [boardTab, setBoardTab] = useState<BoardTab>("checklist");
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [checkins, setCheckins] = useState<CheckinItem[]>([]);
  const [stats, setStats] = useState<CheckinStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [makeupOpen, setMakeupOpen] = useState(false);
  const [makeupDate, setMakeupDate] = useState(toISODate(new Date()));
  const [makeupRuleId, setMakeupRuleId] = useState("");
  const [note, setNote] = useState("");

  const [ruleTitle, setRuleTitle] = useState("");
  const [rulePoints, setRulePoints] = useState("");
  const [ruleDescription, setRuleDescription] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPoints, setEditPoints] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const lastLoadErrorAt = useRef(0);

  const todayIso = useMemo(() => toISODate(new Date()), []);

  const invalidateRulesCache = useCallback(() => {
    if (coupleId) CacheUtils.remove(`rules_list_${coupleId}`);
  }, [coupleId]);

  const notifyLoadError = useCallback(
    (error: unknown, fallback: string) => {
      const now = Date.now();
      if (now - lastLoadErrorAt.current < 3000) return;
      pushToast(getUserErrorMessage(error, fallback), "error");
      lastLoadErrorAt.current = now;
    },
    [pushToast]
  );

  const fetchData = useCallback(async (options?: { forceRulesRefresh?: boolean }) => {
    if (!coupleId || !user?.uid) return;
    const forceRulesRefresh = options?.forceRulesRefresh ?? false;
    setLoading(true);
    try {
      const cacheKey = `rules_list_${coupleId}`;
      let rulesData = forceRulesRefresh ? null : CacheUtils.get<RuleItem[]>(cacheKey);

      if (!rulesData) {
        const rulesResult = await callFunction<{ rules?: RuleItem[] }>("get_rules", {
          uid: user.uid
        });
        rulesData = rulesResult?.rules ?? [];
        CacheUtils.set(cacheKey, rulesData, 600);
      }

      const checkinData = await callFunction<CheckinItem[]>("get_data", {
        type: "checkins",
        params: { today: todayIso },
        uid: user.uid
      });

      setRules(Array.isArray(rulesData) ? rulesData : []);
      setCheckins(Array.isArray(checkinData) ? checkinData : []);
    } catch (error) {
      notifyLoadError(error, "加载打卡数据失败");
    } finally {
      setLoading(false);
    }
  }, [coupleId, notifyLoadError, todayIso, user?.uid]);

  const fetchStats = useCallback(async () => {
    if (!coupleId || !user?.uid) return;
    const end = toISODate(new Date());
    const startD = new Date();
    startD.setDate(startD.getDate() - 365);
    const start = toISODate(startD);

    try {
      const res = await callFunction<CheckinStat[]>("get_data", {
        type: "checkin_stats",
        uid: user.uid,
        params: { start_date: start, end_date: end }
      });
      setStats(Array.isArray(res) ? res : []);
    } catch (error) {
      notifyLoadError(error, "加载统计数据失败");
    }
  }, [coupleId, notifyLoadError, user?.uid]);

  useEffect(() => {
    fetchData();
    fetchStats();
  }, [fetchData, fetchStats]);

  const activeRules = useMemo(
    () => rules.filter((rule) => role === "reviewer" || rule.active),
    [role, rules]
  );

  const doneRuleIds = useMemo(() => {
    const doneIds = new Set<string>();
    activeRules.forEach((rule) => {
      const done = checkins.some(
        (item) =>
          item.rule_id === rule._id &&
          item.period_start === todayIso
      );
      if (done) doneIds.add(rule._id);
    });

    return doneIds;
  }, [activeRules, checkins, todayIso]);

  const completedRules = useMemo(
    () => activeRules.filter((rule) => doneRuleIds.has(rule._id)),
    [activeRules, doneRuleIds]
  );
  const pendingRules = useMemo(
    () => activeRules.filter((rule) => !doneRuleIds.has(rule._id)),
    [activeRules, doneRuleIds]
  );

  const displayedRules = useMemo(
    () => [...pendingRules, ...completedRules],
    [completedRules, pendingRules]
  );

  const totalCount = activeRules.length;
  const completedCount = completedRules.length;
  const pendingCount = pendingRules.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const completedPoints = completedRules.reduce((sum, rule) => sum + rule.points, 0);
  const totalPoints = activeRules.reduce((sum, rule) => sum + rule.points, 0);
  const todayDoneCount = checkins.filter(
    (item) => item.period_type === "day" && item.period_start === todayIso
  ).length;

  const trendDays = useMemo(() => {
    const statsMap = new Map(stats.map((item) => [item._id, item.count]));
    return Array.from({ length: 7 }, (_, idx) => {
      const daysAgo = 6 - idx;
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      const iso = toISODate(date);
      const weekday = date.toLocaleDateString("zh-CN", { weekday: "short" }).replace("周", "");
      return {
        key: iso,
        weekday,
        count: statsMap.get(iso) ?? 0
      };
    });
  }, [stats]);

  const maxTrendCount = useMemo(
    () => Math.max(1, ...trendDays.map((item) => item.count)),
    [trendDays]
  );
  const trendTotal = useMemo(
    () => trendDays.reduce((sum, item) => sum + item.count, 0),
    [trendDays]
  );

  const isDone = (ruleId: string) => doneRuleIds.has(ruleId);

  const emptyText = useMemo(() => {
    if (loading) return "加载中…";
    if (role !== "earner") return "还没有打卡任务";
    return "当前没有可显示的任务";
  }, [loading, role]);

  const handleCheckin = async (ruleId: string) => {
    if (!user?.uid) return;
    try {
      await callFunction("submit_checkin", {
        rule_id: ruleId,
        is_makeup: false,
        event_date: todayIso,
        uid: user.uid
      });

      pushToast("打卡成功！", "success");
      await fetchData();
      fetchStats();
    } catch (error) {
      const ruleErrorType = getRuleStateErrorType(error);
      if (ruleErrorType) {
        invalidateRulesCache();
        if (ruleErrorType === "couple_mismatch") {
          await refreshCouple();
        }
        await fetchData({ forceRulesRefresh: true });
        pushToast(
          ruleErrorType === "couple_mismatch"
            ? "空间信息已更新，列表已刷新"
            : "该规则已下架或删除，列表已刷新",
          "error"
        );
        return;
      }
      pushToast(getUserErrorMessage(error, "打卡失败"), "error");
    }
  };

  const openMakeupModal = (ruleId: string) => {
    setMakeupRuleId(ruleId);
    setMakeupDate(toISODate(new Date()));
    setNote("");
    setMakeupOpen(true);
  };

  const handleMakeup = async () => {
    if (!makeupRuleId) {
      pushToast("请选择补签项目", "error");
      return;
    }

    const eventDate = new Date(makeupDate);
    if (!clampDateWithinDays(eventDate, 3)) {
      pushToast("仅允许补签近 3 天内记录", "error");
      return;
    }

    try {
      await callFunction("submit_checkin", {
        rule_id: makeupRuleId,
        is_makeup: true,
        event_date: makeupDate,
        note,
        uid: user?.uid
      });

      pushToast("补签成功", "success");
      setMakeupOpen(false);
      setNote("");
      await fetchData();
      fetchStats();
    } catch (error) {
      const ruleErrorType = getRuleStateErrorType(error);
      if (ruleErrorType) {
        invalidateRulesCache();
        if (ruleErrorType === "couple_mismatch") {
          await refreshCouple();
        }
        await fetchData({ forceRulesRefresh: true });
        pushToast(
          ruleErrorType === "couple_mismatch"
            ? "空间信息已更新，列表已刷新"
            : "该规则已下架或删除，列表已刷新",
          "error"
        );
        return;
      }
      pushToast(getUserErrorMessage(error, "补签失败"), "error");
    }
  };

  const handleToggleActive = async (rule: RuleItem) => {
    try {
      await callFunction("manage_rule", {
        action: "toggle_active",
        ruleId: rule._id,
        uid: user?.uid
      });
      invalidateRulesCache();
      pushToast(rule.active ? "已下架该规则" : "已上架该规则", "success");
      await fetchData();
    } catch (error) {
      pushToast(getUserErrorMessage(error, "操作失败"), "error");
    }
  };

  const startEdit = (rule: RuleItem) => {
    setEditingId(rule._id);
    setEditTitle(rule.title);
    setEditPoints(rule.points.toString());
    setEditDescription(rule.description ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditPoints("");
    setEditDescription("");
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    if (!editTitle.trim()) {
      pushToast("请输入打卡标题", "error");
      return;
    }

    const pointsValue = Number(editPoints);
    if (!Number.isFinite(pointsValue)) {
      pushToast("请输入正确的分值", "error");
      return;
    }

    try {
      await callFunction("manage_rule", {
        action: "update",
        ruleId: editingId,
        data: {
          title: editTitle.trim(),
          points: pointsValue,
          frequency: "day",
          description: editDescription.trim() || null
        },
        uid: user?.uid
      });

      invalidateRulesCache();
      pushToast("规则已更新", "success");
      cancelEdit();
      await fetchData();
    } catch (error) {
      pushToast(getUserErrorMessage(error, "保存失败"), "error");
    }
  };

  const handleCreateRule = async () => {
    if (!ruleTitle.trim()) {
      pushToast("请输入打卡标题", "error");
      return;
    }

    const pointsValue = Number(rulePoints);
    if (!Number.isFinite(pointsValue)) {
      pushToast("请输入正确的分值", "error");
      return;
    }

    if (!coupleId || !user?.uid) {
      pushToast("未找到情侣空间信息", "error");
      return;
    }

    try {
      await callFunction("manage_rule", {
        action: "create",
        data: {
          title: ruleTitle.trim(),
          points: pointsValue,
          frequency: "day",
          description: ruleDescription.trim() || null
        },
        uid: user.uid
      });

      invalidateRulesCache();
      pushToast("打卡规则已创建", "success");
      setRuleTitle("");
      setRulePoints("");
      setRuleDescription("");
      setCreateOpen(false);
      await fetchData();
    } catch (error) {
      pushToast(getUserErrorMessage(error, "创建失败"), "error");
    }
  };

  return (
    <div>
      <TopBar title="打卡" />
      <div className={`page checkin-page ${role === "reviewer" ? "checkin-page-reviewer" : ""}`}>
        <div className="card checkin-overview-card">
          <div className="section-header">
            <div>
              <div className="section-title">打卡面板</div>
              <div className="card-muted">
                {role === "reviewer"
                  ? `共 ${totalCount} 条规则，当前完成率 ${completionRate}%`
                  : `进度 ${completedCount}/${totalCount}，完成率 ${completionRate}%`}
              </div>
            </div>
          </div>

          <div className="checkin-board-tabs">
            <button
              type="button"
              className={`checkin-tab-btn ${boardTab === "checklist" ? "is-active" : ""}`}
              onClick={() => setBoardTab("checklist")}
            >
              打卡项
            </button>
            <button
              type="button"
              className={`checkin-tab-btn ${boardTab === "trend" ? "is-active" : ""}`}
              onClick={() => setBoardTab("trend")}
            >
              近 7 天趋势
            </button>
          </div>

          <div className="checkin-stats-grid">
            <div className="checkin-stat-card">
              <div className="checkin-stat-value">{completedCount}</div>
              <div className="checkin-stat-label">已完成</div>
            </div>
            <div className="checkin-stat-card">
              <div className="checkin-stat-value">{pendingCount}</div>
              <div className="checkin-stat-label">待完成</div>
            </div>
            <div className="checkin-stat-card">
              <div className="checkin-stat-value">{completedPoints}</div>
              <div className="checkin-stat-label">已得 / 总分 {totalPoints}</div>
            </div>
          </div>
        </div>

        {boardTab === "checklist" ? (
          <div className="checkin-rule-list">
            {displayedRules.map((rule) => {
              const done = isDone(rule._id);
              return (
                <div key={rule._id} className="card checkin-rule-card">
                  <div className="checkin-rule-header">
                    <div className="checkin-rule-main">
                      <div className="checkin-rule-title-row">
                        <div className="checkin-rule-title">{rule.title}</div>
                        {role === "reviewer" ? (
                          <span
                            className={`badge gray checkin-rule-status-badge ${
                              rule.active ? "is-active" : "is-inactive"
                            }`}
                          >
                            {rule.active ? "已上架" : "已下架"}
                          </span>
                        ) : null}
                      </div>
                      {rule.description ? (
                        <div className="card-muted checkin-rule-description">
                          {rule.description}
                        </div>
                      ) : null}
                    </div>
                    <div
                      className={`checkin-points-badge ${
                        rule.points >= 0 ? "is-positive" : "is-negative"
                      }`}
                    >
                      {rule.points > 0 ? `+${rule.points}` : rule.points}
                    </div>
                  </div>

                  {role === "earner" ? (
                    <div className="checkin-action-row">
                      <button
                        className={done ? "btn secondary checkin-action-main is-done" : "btn checkin-action-main"}
                        disabled={done}
                        onClick={() => handleCheckin(rule._id)}
                      >
                        {done ? "已完成" : "去完成"}
                      </button>
                      <button
                        className="btn secondary checkin-action-makeup"
                        onClick={() => openMakeupModal(rule._id)}
                      >
                        补签
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="checkin-action-row checkin-manager-action-row">
                        <button
                          className="btn secondary checkin-action-main"
                          onClick={() => startEdit(rule)}
                        >
                          编辑规则
                        </button>
                        <button
                          className={`btn secondary checkin-action-makeup ${
                            rule.active ? "" : "is-done"
                          }`}
                          onClick={() => handleToggleActive(rule)}
                        >
                          {rule.active ? "下架规则" : "重新上架"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {loading ? <div className="card checkin-empty">加载中…</div> : null}
            {!loading && displayedRules.length === 0 ? (
              <div className="card checkin-empty">{emptyText}</div>
            ) : null}
            {role === "reviewer" ? <div className="checkin-fab-spacer" aria-hidden /> : null}
          </div>
        ) : (
          <div className="card compact checkin-trend-card">
            <div className="section-header">
              <div className="card-title" style={{ marginBottom: 0 }}>
                最近 7 天打卡
              </div>
              <span className="badge gray">{trendTotal} 次</span>
            </div>
            <div className="checkin-trend-grid">
              {trendDays.map((item) => (
                <div key={item.key} className="checkin-trend-col">
                  <div className="checkin-trend-bar-wrap">
                    <div
                      className="checkin-trend-bar"
                      style={{
                        height: `${Math.max(8, (item.count / maxTrendCount) * 54)}px`,
                        opacity: item.count > 0 ? 1 : 0.35
                      }}
                    />
                  </div>
                  <div className="checkin-trend-count">{item.count}</div>
                  <div className="checkin-trend-label">{item.weekday}</div>
                </div>
              ))}
            </div>
            <div className="card-muted">今天完成 {todayDoneCount} 次</div>
          </div>
        )}

        {makeupOpen ? (
          <div className="checkin-modal" onClick={() => setMakeupOpen(false)}>
            <div className="card checkin-modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="card-title">
                补签: {rules.find((rule) => rule._id === makeupRuleId)?.title}
              </div>
              <div className="form">
                <label>
                  <div className="form-label">补签日期</div>
                  <input
                    className="input"
                    type="date"
                    value={makeupDate}
                    onChange={(event) => setMakeupDate(event.target.value)}
                  />
                </label>
                <label>
                  <div className="form-label">备注</div>
                  <textarea
                    className="textarea"
                    style={{ minHeight: 90 }}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="补签原因（可选）"
                  />
                </label>
                <div className="inline-actions" style={{ marginTop: 6 }}>
                  <button className="btn" style={{ flex: 1 }} onClick={handleMakeup}>
                    提交补签
                  </button>
                  <button
                    className="btn secondary"
                    style={{ flex: 1 }}
                    onClick={() => setMakeupOpen(false)}
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {editingId ? (
          <div className="checkin-modal" onClick={cancelEdit}>
            <div
              className="card checkin-modal-card checkin-create-modal-card"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="section-header">
                <div className="card-title" style={{ marginBottom: 0 }}>编辑打卡规则</div>
              </div>
              <div className="card-muted checkin-form-helper">
                保存后会即时生效，当前规则统一按每日处理。
              </div>
              <div className="form" style={{ marginTop: 12 }}>
                <label>
                  <div className="form-label">打卡标题</div>
                  <input
                    className="input"
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                  />
                </label>
                <label>
                  <div className="form-label">积分分值</div>
                  <input
                    className="input"
                    type="number"
                    value={editPoints}
                    onChange={(event) => setEditPoints(event.target.value)}
                  />
                </label>
                <label>
                  <div className="form-label">补充说明</div>
                  <textarea
                    className="textarea"
                    style={{ minHeight: 78 }}
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    placeholder="可选，用于提示打卡标准"
                  />
                </label>
                <div className="inline-actions checkin-create-actions">
                  <button className="btn" style={{ flex: 1 }} onClick={handleSaveEdit}>
                    保存规则
                  </button>
                  <button className="btn secondary" style={{ flex: 1 }} onClick={cancelEdit}>
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {role === "reviewer" ? (
          <>
            <button
              type="button"
              className="checkin-fab"
              onClick={() => setCreateOpen(true)}
              aria-label="新建打卡规则"
            >
              +
            </button>

            {createOpen ? (
              <div className="checkin-modal" onClick={() => setCreateOpen(false)}>
                <div
                  className="card checkin-modal-card checkin-create-modal-card"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="card-title">新建打卡规则</div>
                  <div className="card-muted checkin-form-helper">
                    创建后会立即加入打卡项，支持后续编辑和上下架。
                  </div>
                  <div className="form" style={{ marginTop: 12 }}>
                    <label>
                      <div className="form-label">打卡标题</div>
                      <input
                        className="input"
                        value={ruleTitle}
                        onChange={(event) => setRuleTitle(event.target.value)}
                        placeholder="例如：早起不赖床"
                      />
                    </label>
                    <label>
                      <div className="form-label">积分分值</div>
                      <input
                        className="input"
                        type="number"
                        value={rulePoints}
                        onChange={(event) => setRulePoints(event.target.value)}
                        placeholder="可正可负"
                      />
                    </label>
                    <label>
                      <div className="form-label">补充说明</div>
                      <textarea
                        className="textarea"
                        style={{ minHeight: 78 }}
                        value={ruleDescription}
                        onChange={(event) => setRuleDescription(event.target.value)}
                        placeholder="可选，用于提示打卡标准"
                      />
                    </label>
                    <div className="inline-actions checkin-create-actions">
                      <button className="btn" style={{ flex: 1 }} onClick={handleCreateRule}>
                        创建规则
                      </button>
                      <button
                        className="btn secondary"
                        style={{ flex: 1 }}
                        onClick={() => setCreateOpen(false)}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
