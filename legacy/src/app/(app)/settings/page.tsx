"use client";

import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { auth } from "@/lib/cloudbase";

export default function SettingsPage() {
  const router = useRouter();

  const handleSignOut = async () => {
    await auth.signOut();
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_user");
      localStorage.removeItem("couple_data");
      localStorage.removeItem("cp_dashboard_data");
    }
    router.replace("/auth/login");
  };

  return (
    <div>
      <TopBar title="系统设置" />
      <div className="page">
        <div className="card">
          <div className="card-title">账号</div>
          <button className="btn danger" onClick={handleSignOut}>
            退出登录
          </button>
        </div>
      </div>
    </div>
  );
}
