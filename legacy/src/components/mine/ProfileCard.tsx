"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useCouple } from "@/providers/CoupleProvider";
import { ProfileService } from "@/services/profile";
import { compressImage } from "@/utils/image";
import { useToast } from "@/providers/ToastProvider";
import { CacheUtils } from "@/utils/cache";
import { getUserErrorMessage } from "@/utils/error";

export function ProfileCard() {
  const { user } = useAuth();
  const { role } = useCouple();
  const { pushToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nickname, setNickname] = useState(user?.displayName || "");
  const [loading, setLoading] = useState(false);

  // Default avatars and names
  const defaultName = role === "reviewer" ? "小白" : "小鸡毛";
  const displayName = nickname || defaultName;
  const displayRole = role === "reviewer" ? "小白" : "小鸡毛";

  const [tempAvatarUrl, setTempAvatarUrl] = useState("");
  const [avatarBroken, setAvatarBroken] = useState(false);
  const refreshTriedRef = useRef<Set<string>>(new Set());
  const rawPhotoUrl = user?.photoURL?.trim() || "";
  const isCloudFileId = rawPhotoUrl.startsWith("cloud://");

  // 获取临时链接
  const fetchTempUrl = async (fileId: string, forceRefresh = false) => {
    // Check cache first
    const cacheKey = `avatar_url_${fileId}`;
    if (!forceRefresh) {
      const cachedUrl = CacheUtils.get<string>(cacheKey);
      if (cachedUrl) {
        setTempAvatarUrl(cachedUrl);
        setAvatarBroken(false);
        return;
      }
    }

    try {
      const { cloud } = await import("@/lib/cloudbase");
      const res = await cloud.getTempFileURL({
        fileList: [fileId],
      });
      if (res.fileList && res.fileList.length > 0) {
        const item = res.fileList[0];
        const url = item?.tempFileURL;
        if (typeof url === "string" && url) {
          setTempAvatarUrl(url);
          setAvatarBroken(false);
          // Keep cache shorter to reduce using near-expired temporary URLs.
          CacheUtils.set(cacheKey, url, 20 * 60);
        } else {
          setTempAvatarUrl("");
          setAvatarBroken(true);
          CacheUtils.remove(cacheKey);
        }
      } else {
        setTempAvatarUrl("");
        setAvatarBroken(true);
        CacheUtils.remove(cacheKey);
      }
    } catch {
      setTempAvatarUrl("");
      setAvatarBroken(true);
    }
  };

  // 当 user.photoURL 变化时，如果是 cloud:// 开头，则去换取 http 链接
  useEffect(() => {
    setAvatarBroken(false);
    if (isCloudFileId) {
        refreshTriedRef.current.delete(rawPhotoUrl);
        fetchTempUrl(rawPhotoUrl);
    } else {
        setTempAvatarUrl("");
    }
  }, [isCloudFileId, rawPhotoUrl]);

  // Never render cloud:// in <img src>, only use converted temp URL.
  const avatarSrc = isCloudFileId ? tempAvatarUrl : rawPhotoUrl;

  const handleAvatarLoadError = () => {
    if (isCloudFileId && rawPhotoUrl && !refreshTriedRef.current.has(rawPhotoUrl)) {
      refreshTriedRef.current.add(rawPhotoUrl);
      CacheUtils.remove(`avatar_url_${rawPhotoUrl}`);
      void fetchTempUrl(rawPhotoUrl, true);
      return;
    }
    setAvatarBroken(true);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const compressed = await compressImage(file);
      const fileID = await ProfileService.uploadAvatar(compressed);
      // Construct https url from fileID if needed, or just store fileID
      // Usually fileID (cloud://...) works with cloudbase image component, but for next/image we need http url.
      // For simplicity, let's assume we can get a temp url or public url.
      // Actually, storing fileID is better, but to display it immediately we need a temp URL.
      // Let's just update the profile with fileID for now, and hope we can resolve it.
      // Wait, next/image needs a valid src.
      // If we use cloud:// id, we need a converter.
      // Let's use a simpler approach: Update profile with fileID.
      // Note: In a real app, we'd swap this for a signed URL or CDN URL.
      // For now, let's assume the user will reload or we handle it.
      // Actually, let's just use the fileID and let the backend/frontend handle it?
      // No, `user.photoURL` is standard. Let's try to get a temp URL or public HTTP URL if possible.
      // CloudBase `getTempFileURL` can do this.
      // But for this task, let's just save the fileID.

      // Update: User requested "display immediately".
      // We can show a local preview.

      await ProfileService.updateProfile({ avatar_url: fileID });
      pushToast("头像已更新", "success");
      // Ideally reload user profile here
      window.location.reload();
    } catch (err) {
      pushToast(getUserErrorMessage(err, "头像上传失败"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleNameSave = async () => {
    if (!nickname.trim()) return;
    setLoading(true);
    try {
      await ProfileService.updateProfile({ nickname: nickname.trim() });
      setIsEditingName(false);
      pushToast("昵称已更新", "success");
      // Ideally reload user profile here
      window.location.reload();
    } catch (err) {
      pushToast(getUserErrorMessage(err, "更新失败"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card card-profile">
      <div className="card-profile-inner">
        <button type="button" className="profile-avatar" onClick={handleAvatarClick}>
          {avatarSrc && !avatarBroken ? (
            <img
              src={avatarSrc}
              alt="avatar"
              onError={handleAvatarLoadError}
              className="profile-avatar-image"
            />
          ) : (
            <div className="profile-avatar-fallback">{role === "reviewer" ? "👩" : "👨"}</div>
          )}
          {loading ? <div className="profile-avatar-loading">上传中</div> : null}
        </button>
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="profile-file-input"
          onChange={handleFileChange}
        />

        {isEditingName ? (
          <div className="profile-name-edit">
            <input
              className="input profile-name-input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoFocus
            />
            <button className="btn profile-name-save" onClick={handleNameSave}>
              保存
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingName(true)}
            className="profile-name-display"
          >
            <span>{displayName}</span>
            <span className="profile-name-edit-tag">✎</span>
          </button>
        )}

        <div className="profile-role">{displayRole}</div>
      </div>
    </div>
  );
}
