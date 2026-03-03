"use client";

import { useRouter } from "next/navigation";

interface TopBarAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function TopBar({
  title,
  back,
  onBack,
  rightAction,
}: {
  title: string;
  back?: boolean;
  onBack?: () => void;
  rightAction?: TopBarAction;
}) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  return (
    <div className="topbar">
      {back || onBack ? (
        <button type="button" className="icon-button" aria-label="返回" onClick={handleBack}>
          ←
        </button>
      ) : (
        <div className="icon-spacer" />
      )}
      <div className="topbar-title">{title}</div>
      {rightAction ? (
        <button
          type="button"
          className="topbar-action-btn"
          onClick={rightAction.onClick}
          disabled={rightAction.disabled}
        >
          {rightAction.label}
        </button>
      ) : (
        <div className="icon-spacer" />
      )}
    </div>
  );
}
