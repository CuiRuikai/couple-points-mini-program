import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/providers/AuthProvider";
import { CoupleProvider } from "@/providers/CoupleProvider";
import { ToastProvider } from "@/providers/ToastProvider";

export const metadata: Metadata = {
  title: "情侣空间",
  description: "情侣积分与打卡私密空间",
  manifest: "/couple-points/manifest.webmanifest",
  icons: {
    icon: "/couple-points/icons/icon.png",
    apple: "/couple-points/icons/icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "情侣空间",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#f0f7ff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hans" suppressHydrationWarning>
      <body>
        <ToastProvider>
          <AuthProvider>
            <CoupleProvider>{children}</CoupleProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
