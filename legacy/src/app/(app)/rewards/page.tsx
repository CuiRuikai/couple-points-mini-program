"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { callFunction, cloud } from "@/lib/cloudbase";
import { useCouple } from "@/providers/CoupleProvider";
import { useToast } from "@/providers/ToastProvider";
import { useAuth } from "@/providers/AuthProvider";
import { compressImage } from "@/utils/image";

interface RewardItem {
  _id: string;
  title: string;
  cost_points: number;
  description?: string | null;
  image_url?: string | null;
  active: boolean;
  redeemed_count?: number;
  used_count?: number;
}

interface RewardSummary {
  redeemed_count: number;
  active_count: number;
  inactive_count: number;
  used_count: number;
}

export default function RewardsPage() {
  const { role, coupleId } = useCouple();
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [summary, setSummary] = useState<RewardSummary>({
    redeemed_count: 0,
    active_count: 0,
    inactive_count: 0,
    used_count: 0
  });
  const [loading, setLoading] = useState(true);
  const [imageUrlMap, setImageUrlMap] = useState<Record<string, string>>({});

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState("");
  const [description, setDescription] = useState("");
  const [createImageFile, setCreateImageFile] = useState<File | null>(null);
  const [createImagePreview, setCreateImagePreview] = useState("");
  const createImageInputRef = useRef<HTMLInputElement>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState("");
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const editImageInputRef = useRef<HTMLInputElement>(null);

  const fetchRewards = useCallback(async () => {
    if (!coupleId || !user?.uid) return;
    setLoading(true);
    try {
      const rewardsResult = await callFunction<any>("get_rewards", { uid: user.uid });
      const rewardsData: RewardItem[] = rewardsResult?.rewards ?? [];
      setRewards(rewardsData);

      const fallbackSummary: RewardSummary = {
        redeemed_count: rewardsData.reduce((sum, item) => sum + (Number(item.redeemed_count) || 0), 0),
        active_count: rewardsData.filter((item) => item.active).length,
        inactive_count: rewardsData.filter((item) => !item.active).length,
        used_count: rewardsData.reduce((sum, item) => sum + (Number(item.used_count) || 0), 0)
      };
      setSummary(rewardsResult?.summary ?? fallbackSummary);
    } catch (err) {
      console.error("Fetch rewards failed", err);
      pushToast("获取奖励失败", "error");
    } finally {
      setLoading(false);
    }
  }, [coupleId, pushToast, user?.uid]);

  useEffect(() => {
    fetchRewards();
  }, [fetchRewards]);

  useEffect(() => {
    const cloudImageIds = Array.from(
      new Set(
        rewards
          .map((item) => item.image_url?.trim())
          .filter((value): value is string => !!value && value.startsWith("cloud://"))
      )
    );

    if (cloudImageIds.length === 0) {
      setImageUrlMap({});
      return;
    }

    let cancelled = false;
    cloud
      .getTempFileURL({ fileList: cloudImageIds })
      .then((res: any) => {
        if (cancelled) return;
        const nextMap: Record<string, string> = {};
        (res?.fileList ?? []).forEach((item: any) => {
          if (item?.fileID && item?.tempFileURL) {
            nextMap[item.fileID] = item.tempFileURL;
          }
        });
        setImageUrlMap(nextMap);
      })
      .catch((error: any) => {
        console.error("Resolve reward image URL failed", error);
      });

    return () => {
      cancelled = true;
    };
  }, [rewards]);

  useEffect(() => {
    return () => {
      if (createImagePreview) URL.revokeObjectURL(createImagePreview);
      if (editImagePreview) URL.revokeObjectURL(editImagePreview);
    };
  }, [createImagePreview, editImagePreview]);

  const resolveRewardImageSrc = useCallback(
    (imageUrl?: string | null) => {
      const raw = imageUrl?.trim() || "";
      if (!raw) return "";
      if (raw.startsWith("cloud://")) return imageUrlMap[raw] || "";
      return raw;
    },
    [imageUrlMap]
  );

  const fileToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const uploadRewardImage = useCallback(
    async (file: File) => {
      const compressed = await compressImage(file, 900, 0.72);
      const fileContent = await fileToBase64(compressed);
      const result = await callFunction<any>("manage_reward", {
        action: "upload_image",
        data: { fileContent, fileName: "reward.jpg" },
        uid: user?.uid
      });
      return result?.fileID as string;
    },
    [user?.uid]
  );

  const resetCreateForm = () => {
    setTitle("");
    setCost("");
    setDescription("");
    setCreateImageFile(null);
    if (createImagePreview) URL.revokeObjectURL(createImagePreview);
    setCreateImagePreview("");
    if (createImageInputRef.current) createImageInputRef.current.value = "";
  };

  const handleCreateImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCreateImageFile(file);
    if (createImagePreview) URL.revokeObjectURL(createImagePreview);
    setCreateImagePreview(URL.createObjectURL(file));
  };

  const handleEditImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setEditImageFile(file);
    if (editImagePreview) URL.revokeObjectURL(editImagePreview);
    setEditImagePreview(URL.createObjectURL(file));
  };

  const triggerCreateImagePick = () => {
    createImageInputRef.current?.click();
  };

  const triggerEditImagePick = () => {
    editImageInputRef.current?.click();
  };

  const clearEditImage = () => {
    setEditImageUrl(null);
    setEditImageFile(null);
    if (editImagePreview) URL.revokeObjectURL(editImagePreview);
    setEditImagePreview("");
    if (editImageInputRef.current) editImageInputRef.current.value = "";
  };

  const visibleRewards = useMemo(
    () => rewards.filter((reward) => (role === "reviewer" ? true : reward.active)),
    [rewards, role]
  );

  const handleCreate = async () => {
    const costValue = Number(cost);
    if (!title.trim() || cost.trim() === "") {
      pushToast("请填写奖励名称与积分", "error");
      return;
    }
    if (!Number.isFinite(costValue)) {
      pushToast("请输入正确的积分", "error");
      return;
    }
    if (!coupleId || !user) {
      pushToast("未找到情侣空间信息", "error");
      return;
    }

    try {
      let imageUrl: string | null = null;
      if (createImageFile) {
        imageUrl = await uploadRewardImage(createImageFile);
      }

      await callFunction("manage_reward", {
        action: "create",
        data: {
          title: title.trim(),
          cost_points: costValue,
          description: description.trim() || null,
          image_url: imageUrl,
        },
        uid: user.uid,
      });

      pushToast("奖励已创建", "success");
      resetCreateForm();
      setCreateOpen(false);
      fetchRewards();
    } catch (error: any) {
      pushToast(error.message || "创建失败", "error");
    }
  };

  const openEditModal = (reward: RewardItem) => {
    setEditingRewardId(reward._id);
    setEditTitle(reward.title ?? "");
    setEditCost(reward.cost_points?.toString() ?? "");
    setEditDescription(reward.description ?? "");
    setEditImageUrl(reward.image_url ?? null);
    setEditImageFile(null);
    if (editImagePreview) URL.revokeObjectURL(editImagePreview);
    setEditImagePreview("");
    setEditOpen(true);
  };

  const closeEditModal = () => {
    setEditOpen(false);
    setEditingRewardId(null);
    setEditTitle("");
    setEditCost("");
    setEditDescription("");
    setEditImageUrl(null);
    setEditImageFile(null);
    if (editImagePreview) URL.revokeObjectURL(editImagePreview);
    setEditImagePreview("");
    if (editImageInputRef.current) editImageInputRef.current.value = "";
  };

  const handleSaveEdit = async () => {
    if (!editingRewardId) return;
    const costValue = Number(editCost);
    if (!editTitle.trim() || editCost.trim() === "") {
      pushToast("请填写奖励名称与积分", "error");
      return;
    }
    if (!Number.isFinite(costValue)) {
      pushToast("请输入正确的积分", "error");
      return;
    }

    try {
      let nextImageUrl: string | null = editImageUrl;
      if (editImageFile) {
        nextImageUrl = await uploadRewardImage(editImageFile);
      }

      await callFunction("manage_reward", {
        action: "update",
        rewardId: editingRewardId,
        data: {
          title: editTitle.trim(),
          cost_points: costValue,
          description: editDescription.trim() || null,
          image_url: nextImageUrl,
        },
        uid: user?.uid,
      });
      pushToast("奖励已更新", "success");
      closeEditModal();
      fetchRewards();
    } catch (error: any) {
      pushToast(error.message || "更新失败", "error");
    }
  };

  const toggleActive = async (reward: RewardItem) => {
    try {
      await callFunction("manage_reward", {
        action: "toggle_active",
        rewardId: reward._id,
        uid: user?.uid,
      });
      fetchRewards();
    } catch (error: any) {
      pushToast(error.message || "操作失败", "error");
    }
  };

  return (
    <div>
      <TopBar title="奖励" />
      <div className={`page rewards-page ${role === "reviewer" ? "rewards-page-reviewer" : ""}`}>
        <div className="card rewards-summary-card">
          <div className="section-header">
            <div>
              <div className="card-title rewards-summary-title">奖励清单</div>
              {role === "reviewer" ? null : <div className="card-muted">浏览可兑换奖励</div>}
            </div>
            <span className="badge gray">{loading ? "同步中…" : `${visibleRewards.length} 条`}</span>
          </div>
          {role === "reviewer" ? (
            <div className="rewards-stats-grid">
              <div className="rewards-stat-card">
                <div className="rewards-stat-value">{loading ? "-" : summary.active_count}</div>
                <div className="rewards-stat-label">已上架</div>
              </div>
              <div className="rewards-stat-card">
                <div className="rewards-stat-value">{loading ? "-" : summary.inactive_count}</div>
                <div className="rewards-stat-label">已下架</div>
              </div>
              <div className="rewards-stat-card">
                <div className="rewards-stat-value">{loading ? "-" : summary.redeemed_count}</div>
                <div className="rewards-stat-label">已兑换</div>
              </div>
              <div className="rewards-stat-card">
                <div className="rewards-stat-value">{loading ? "-" : summary.used_count}</div>
                <div className="rewards-stat-label">已核销</div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rewards-list">
          {visibleRewards.map((reward) => (
            <div key={reward._id} className="card rewards-item-card">
              <div className="reward-cover">
                {resolveRewardImageSrc(reward.image_url) ? (
                  <img
                    src={resolveRewardImageSrc(reward.image_url)}
                    alt={reward.title}
                    className="reward-cover-image"
                  />
                ) : (
                  <div className="reward-cover-fallback">🎁</div>
                )}
                <div className="reward-cover-mask" />
              </div>
              <div className="rewards-item-meta">
                <div className="rewards-item-title-row">
                  <div className="rewards-item-title">{reward.title}</div>
                  {role === "reviewer" ? (
                    <span
                      className={`badge gray status-badge rewards-status-badge ${
                        reward.active ? "is-active" : "is-inactive"
                      }`}
                    >
                      {reward.active ? "已上架" : "已下架"}
                    </span>
                  ) : null}
                </div>
                <div className="rewards-cost-badge">{reward.cost_points} 分</div>
              </div>

              {role === "reviewer" ? (
                <div className="rewards-tile-actions">
                  <button
                    className="btn secondary rewards-tile-btn"
                    onClick={() => openEditModal(reward)}
                  >
                    编辑
                  </button>
                  <button
                    className={`btn secondary rewards-tile-btn ${reward.active ? "" : "is-done"}`}
                    onClick={() => toggleActive(reward)}
                  >
                    {reward.active ? "下架" : "上架"}
                  </button>
                </div>
              ) : (
                <Link className="btn secondary rewards-tile-btn rewards-tile-btn-full" href={`/rewards/${reward._id}`}>
                  查看
                </Link>
              )}
            </div>
          ))}

          {loading ? <div className="card rewards-empty">加载中…</div> : null}
          {!loading && visibleRewards.length === 0 ? (
            <div className="card rewards-empty">暂无奖励</div>
          ) : null}
          {role === "reviewer" ? <div className="rewards-fab-spacer" aria-hidden /> : null}
        </div>

        {editOpen ? (
          <div className="app-modal" onClick={closeEditModal}>
            <div
              className="card app-modal-card app-modal-card-wide"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="card-title">编辑奖励</div>
              <div className="form" style={{ marginTop: 12 }}>
                <label>
                  <div className="form-label">奖励标题</div>
                  <input
                    className="input"
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                  />
                </label>
                <label>
                  <div className="form-label">所需积分</div>
                  <input
                    className="input"
                    type="number"
                    value={editCost}
                    onChange={(event) => setEditCost(event.target.value)}
                  />
                </label>
                <label>
                  <div className="form-label">奖励说明</div>
                  <textarea
                    className="textarea"
                    style={{ minHeight: 78 }}
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    placeholder="可选，用于描述奖励内容"
                  />
                </label>
                <div>
                  <div className="form-label" style={{ marginBottom: 8 }}>奖励图片</div>
                  <input
                    ref={editImageInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleEditImageChange}
                  />
                  <div className="reward-picker-card">
                    <div className="reward-picker-preview">
                      {editImagePreview || resolveRewardImageSrc(editImageUrl) ? (
                        <img
                          src={editImagePreview || resolveRewardImageSrc(editImageUrl)}
                          alt="reward preview"
                          className="reward-cover-image"
                        />
                      ) : (
                        <div className="reward-cover-fallback">🎁</div>
                      )}
                      <div className="reward-cover-mask" />
                    </div>
                    <div className="reward-picker-actions">
                      <button type="button" className="btn secondary" onClick={triggerEditImagePick}>
                        更换图片
                      </button>
                      <button type="button" className="btn ghost" onClick={clearEditImage}>
                        使用默认礼物
                      </button>
                    </div>
                  </div>
                </div>
                <div className="inline-actions modal-actions">
                  <button className="btn" style={{ flex: 1 }} onClick={handleSaveEdit}>
                    保存修改
                  </button>
                  <button className="btn secondary" style={{ flex: 1 }} onClick={closeEditModal}>
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
              className="fab-primary"
              onClick={() => setCreateOpen(true)}
              aria-label="新增奖励"
            >
              +
            </button>

            {createOpen ? (
              <div
                className="app-modal"
                onClick={() => {
                  setCreateOpen(false);
                  resetCreateForm();
                }}
              >
                <div
                  className="card app-modal-card app-modal-card-wide"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="card-title">新增奖励</div>
                  <div className="form" style={{ marginTop: 12 }}>
                    <label>
                      <div className="form-label">奖励标题</div>
                      <input
                        className="input"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="例如：请你喝奶茶"
                      />
                    </label>
                    <label>
                      <div className="form-label">所需积分</div>
                      <input
                        className="input"
                        type="number"
                        value={cost}
                        onChange={(event) => setCost(event.target.value)}
                        placeholder="请输入积分"
                      />
                    </label>
                    <label>
                      <div className="form-label">奖励说明</div>
                      <textarea
                        className="textarea"
                        style={{ minHeight: 78 }}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="可选，用于描述奖励内容"
                      />
                    </label>
                    <div>
                      <div className="form-label" style={{ marginBottom: 8 }}>奖励图片</div>
                      <input
                        ref={createImageInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={handleCreateImageChange}
                      />
                      <div className="reward-picker-card">
                        <div className="reward-picker-preview">
                          {createImagePreview ? (
                            <img
                              src={createImagePreview}
                              alt="reward preview"
                              className="reward-cover-image"
                            />
                          ) : (
                            <div className="reward-cover-fallback">🎁</div>
                          )}
                          <div className="reward-cover-mask" />
                        </div>
                        <button type="button" className="btn secondary" onClick={triggerCreateImagePick}>
                          上传图片
                        </button>
                      </div>
                    </div>
                    <div className="inline-actions modal-actions">
                      <button className="btn" style={{ flex: 1 }} onClick={handleCreate}>
                        新增奖励
                      </button>
                      <button
                        className="btn secondary"
                        style={{ flex: 1 }}
                        onClick={() => {
                          setCreateOpen(false);
                          resetCreateForm();
                        }}
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
