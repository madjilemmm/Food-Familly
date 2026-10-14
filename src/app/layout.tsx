import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { AutoUpdate } from "@/components/pwa/AutoUpdate";

const rubik = Rubik({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-rubik", display: "swap" });

export const metadata: Metadata = {
  title: "Kaddie",
  description: "Les courses de la famille, en un swipe.",
  applicationName: "Kaddie",
  appleWebApp: {
    capable: true,
    title: "Kaddie",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    // SVG pour les navigateurs qui le lisent ; PNG aux coins arrondis pour Safari iOS (sinon liseré blanc).
    icon: [
      { url: "/icons/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#971cd0",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${rubik.variable} kd-app font-sans`}>
        {/* Barre d'état iPhone (texte blanc) : toujours sur du violet, même au-dessus des écrans lilas */}
        <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[env(safe-area-inset-top)] bg-violet" />
        <ServiceWorkerRegister />
        <AutoUpdate />
        {children}
      </body>
    </html>
  );
}
