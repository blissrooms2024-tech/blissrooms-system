import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Bliss Rooms System",
  description: "Bliss Rooms Enterprise 出租管理系统",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
