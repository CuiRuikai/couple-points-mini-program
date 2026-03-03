"use client";

import { usePathname } from "next/navigation";
import { TabBar } from "@/components/layout/TabBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideTabBar = pathname?.startsWith("/memo/editor") || pathname?.startsWith("/couple-points/memo/editor");

  return (
    <div className="app-shell">
      <div className="app-content">{children}</div>
      {hideTabBar ? null : <TabBar />}
    </div>
  );
}
