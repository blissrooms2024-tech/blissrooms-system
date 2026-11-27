import type { MetadataRoute } from "next";

/** Lets staff "Add to Home Screen" so the system opens full-screen like an app, without
 * the browser's address bar. "/" sends each person to their own home page after login. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bliss Rooms 租房管理",
    short_name: "Bliss Rooms",
    description: "Bliss Rooms Enterprise 出租管理系统",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f7fc",
    theme_color: "#7c3aed",
    lang: "zh",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
