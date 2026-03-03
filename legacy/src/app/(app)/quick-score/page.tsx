"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { useToast } from "@/providers/ToastProvider";
import { ProfileService } from "@/services/profile";
import {
  DEFAULT_QUICK_SCORE_OPTIONS,
  normalizeQuickScoreOptions,
  optionsToText,
  parseOptionsText,
  QUICK_SCORE_OPTION_OTHER,
} from "@/utils/quickScore";

export default function QuickScoreSettingsPage() {
  const { pushToast } = useToast();

  const [plusText, setPlusText] = useState(
    optionsToText([...DEFAULT_QUICK_SCORE_OPTIONS.plus])
  );
  const [minusText, setMinusText] = useState(
    optionsToText([...DEFAULT_QUICK_SCORE_OPTIONS.minus])
  );
  const [loadingQuickOptions, setLoadingQuickOptions] = useState(true);
  const [savingQuickOptions, setSavingQuickOptions] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      setLoadingQuickOptions(true);
      try {
        const profile = await ProfileService.getProfile();
        if (cancelled) return;
        if (!profile) return;

        const plusOptions = normalizeQuickScoreOptions(
          profile.quick_score_plus_options,
          DEFAULT_QUICK_SCORE_OPTIONS.plus
        );
        const minusOptions = normalizeQuickScoreOptions(
          profile.quick_score_minus_options,
          DEFAULT_QUICK_SCORE_OPTIONS.minus
        );

        setPlusText(optionsToText(plusOptions));
        setMinusText(optionsToText(minusOptions));
      } catch (error: any) {
        if (!cancelled) {
          pushToast(error?.message || "加载快捷项目失败", "error");
        }
      } finally {
        if (!cancelled) {
          setLoadingQuickOptions(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [pushToast]);

  const handleSaveQuickOptions = async () => {
    const plusOptions = parseOptionsText(plusText);
    const minusOptions = parseOptionsText(minusText);

    const plusCustomCount = plusOptions.filter(
      (item) => item !== QUICK_SCORE_OPTION_OTHER
    ).length;
    const minusCustomCount = minusOptions.filter(
      (item) => item !== QUICK_SCORE_OPTION_OTHER
    ).length;
    if (plusCustomCount < 1 || minusCustomCount < 1) {
      pushToast("加分和减分都至少要有一个备选项（不含“其他”）", "error");
      return;
    }

    setSavingQuickOptions(true);
    try {
      await ProfileService.updateProfile({
        quick_score_plus_options: plusOptions,
        quick_score_minus_options: minusOptions,
      });
      setPlusText(optionsToText(plusOptions));
      setMinusText(optionsToText(minusOptions));
      pushToast("快捷加减分项目已保存", "success");
    } catch (error: any) {
      pushToast(error?.message || "保存失败", "error");
    } finally {
      setSavingQuickOptions(false);
    }
  };

  return (
    <div>
      <TopBar title="快捷加减分项目" back />
      <div className="page">
        <div className="card">
          <div className="card-muted">
            每行一个项目，也支持用逗号分隔。系统会自动保留“其他”选项。
          </div>
          <div className="form" style={{ marginTop: 12 }}>
            <label>
              <div className="form-label">加分项目</div>
              <textarea
                className="textarea"
                style={{ minHeight: 110 }}
                value={plusText}
                onChange={(event) => setPlusText(event.target.value)}
                placeholder="例如：家务"
                disabled={loadingQuickOptions || savingQuickOptions}
              />
            </label>
            <label>
              <div className="form-label">减分项目</div>
              <textarea
                className="textarea"
                style={{ minHeight: 110 }}
                value={minusText}
                onChange={(event) => setMinusText(event.target.value)}
                placeholder="例如：不做家务"
                disabled={loadingQuickOptions || savingQuickOptions}
              />
            </label>
            <button
              className="btn"
              onClick={handleSaveQuickOptions}
              disabled={loadingQuickOptions || savingQuickOptions}
            >
              {savingQuickOptions ? "保存中…" : "保存快捷项目"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
