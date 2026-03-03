"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, callFunction } from "@/lib/cloudbase";
import { useToast } from "@/providers/ToastProvider";
import { ProfileService } from "@/services/profile";
import { toISODate } from "@/utils/date";
import {
  DEFAULT_QUICK_SCORE_OPTIONS,
  normalizeQuickScoreOptions,
  QUICK_SCORE_OPTION_OTHER,
} from "@/utils/quickScore";

type QuickActionMode = "plus" | "minus";

interface HomeQuickScoreCardProps {
  onRefresh?: () => Promise<void> | void;
}

export function HomeQuickScoreCard({ onRefresh }: HomeQuickScoreCardProps) {
  const { pushToast } = useToast();

  const [options, setOptions] = useState<{
    plus: string[];
    minus: string[];
  }>({
    plus: [...DEFAULT_QUICK_SCORE_OPTIONS.plus],
    minus: [...DEFAULT_QUICK_SCORE_OPTIONS.minus],
  });

  const [quickMode, setQuickMode] = useState<QuickActionMode>("plus");
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickPoints, setQuickPoints] = useState("");
  const [quickReason, setQuickReason] = useState<string>(
    DEFAULT_QUICK_SCORE_OPTIONS.plus[0]
  );
  const [customReason, setCustomReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const profile = await ProfileService.getProfile();
        if (!profile) return;
        setOptions({
          plus: normalizeQuickScoreOptions(
            profile.quick_score_plus_options,
            DEFAULT_QUICK_SCORE_OPTIONS.plus
          ),
          minus: normalizeQuickScoreOptions(
            profile.quick_score_minus_options,
            DEFAULT_QUICK_SCORE_OPTIONS.minus
          ),
        });
      } catch {
        // fallback to defaults silently
      }
    };

    loadOptions();
  }, []);

  const quickReasonOptions = useMemo(() => options[quickMode], [options, quickMode]);

  const resetQuickForm = (mode: QuickActionMode) => {
    setQuickMode(mode);
    setQuickPoints("");
    setQuickReason(options[mode][0] || QUICK_SCORE_OPTION_OTHER);
    setCustomReason("");
  };

  const openQuickModal = (mode: QuickActionMode) => {
    resetQuickForm(mode);
    setQuickOpen(true);
  };

  const closeQuickModal = () => {
    if (submitting) return;
    setQuickOpen(false);
  };

  const handleQuickSubmit = async () => {
    const numericPoints = Number(quickPoints);
    if (!Number.isFinite(numericPoints) || numericPoints <= 0) {
      pushToast("请输入大于 0 的分数", "error");
      return;
    }

    const finalReason =
      quickReason === QUICK_SCORE_OPTION_OTHER ? customReason.trim() : quickReason;
    if (!finalReason) {
      pushToast("请填写简要原因", "error");
      return;
    }

    const signedPoints =
      quickMode === "plus" ? Math.abs(numericPoints) : -Math.abs(numericPoints);

    setSubmitting(true);
    try {
      await callFunction("submit_special", {
        title: "其他",
        note: finalReason,
        points_suggested: signedPoints,
        event_date: toISODate(new Date()),
        uid: auth.currentUser?.uid,
      });

      pushToast(
        quickMode === "plus"
          ? `已加分 +${Math.abs(signedPoints)}`
          : `已减分 ${signedPoints}`,
        "success"
      );
      closeQuickModal();
      await onRefresh?.();
    } catch (error: any) {
      pushToast(error?.message || "提交失败", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="card compact home-quick-score-entry">
        <div className="home-quick-score-tabs">
          <button
            type="button"
            className="home-quick-score-tab is-plus"
            onClick={() => openQuickModal("plus")}
          >
            加分
          </button>
          <button
            type="button"
            className="home-quick-score-tab is-minus"
            onClick={() => openQuickModal("minus")}
          >
            减分
          </button>
        </div>
      </div>

      {quickOpen ? (
        <div className="app-modal" onClick={closeQuickModal}>
          <div
            className="card app-modal-card home-quick-score-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="card-title">
              {quickMode === "plus" ? "直接加分" : "直接减分"}
            </div>

            <div className="form" style={{ marginTop: 12 }}>
              <label>
                <div className="form-label">分数</div>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={quickPoints}
                  onChange={(event) => setQuickPoints(event.target.value)}
                  placeholder="请输入分数"
                  disabled={submitting}
                />
              </label>

              <div>
                <div className="form-label">简要原因</div>
                <div className="home-quick-score-reasons">
                  {quickReasonOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`home-quick-score-reason-btn ${
                        quickReason === option ? "is-active" : ""
                      }`}
                      onClick={() => setQuickReason(option)}
                      disabled={submitting}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {quickReason === QUICK_SCORE_OPTION_OTHER ? (
                <label>
                  <div className="form-label">其他原因</div>
                  <input
                    className="input"
                    value={customReason}
                    onChange={(event) => setCustomReason(event.target.value)}
                    placeholder="请输入原因"
                    disabled={submitting}
                  />
                </label>
              ) : null}

              <div className="inline-actions home-quick-score-actions">
                <button
                  className="btn"
                  type="button"
                  style={{ flex: 1 }}
                  onClick={handleQuickSubmit}
                  disabled={submitting}
                >
                  {submitting
                    ? "提交中…"
                    : quickMode === "plus"
                    ? "确认加分"
                    : "确认减分"}
                </button>
                <button
                  className="btn secondary"
                  type="button"
                  style={{ flex: 1 }}
                  onClick={closeQuickModal}
                  disabled={submitting}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
