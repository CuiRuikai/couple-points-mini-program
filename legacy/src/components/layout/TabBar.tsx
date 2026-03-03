"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/checkin", label: "", icon: "/icons/checkin.ico" },
  { href: "/statistics", label: "", icon: "/icons/stats.ico" },
  { href: "/home", label: "", icon: "/icons/home.ico" },
  { href: "/memo", label: "", icon: "/icons/note.ico" },
  { href: "/mine", label: "", icon: "/icons/mine.ico" },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="tabbar">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        const isHome = tab.href === "/home";
        
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`tabbar-item ${active ? "is-active" : ""} ${
              isHome ? "tabbar-item-home" : ""
            }`}
          >
            <div className="tabbar-icon">
              <img
                src={`/couple-points${tab.icon}`}
                alt={tab.href}
                className={`tabbar-icon-img ${active ? "is-active" : ""}`}
              />
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
