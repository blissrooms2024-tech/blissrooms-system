import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { LanguageProvider } from "@/components/LanguageProvider";

export const metadata: Metadata = {
  title: "Bliss Rooms System",
  description: "Bliss Rooms Enterprise 出租管理系统",
  // Opened from the iPhone home screen it runs full-screen; the purple header and the login
  // photo extend under the status bar (each pads itself with env(safe-area-inset-top)).
  appleWebApp: { capable: true, title: "Bliss Rooms", statusBarStyle: "black-translucent" },
};

// viewportFit "cover" lets the phone tab bar sit in the home-indicator area (padded with
// env(safe-area-inset-bottom)); the theme colour tints the phone's status bar to match the header.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#7c3aed",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <LanguageProvider>
          <ToastProvider>{children}</ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
