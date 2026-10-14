import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { AutoUpdate } from "@/components/pwa/AutoUpdate";

export const metadata: Metadata = {
  title: "Kaddie",
  description: "Les courses et les repas de la famille, sans prise de tête.",
  applicationName: "Kaddie",
  appleWebApp: {
    capable: true,
    title: "Kaddie",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fff8f0",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="min-h-dvh font-sans antialiased">
        <ServiceWorkerRegister />
        <AutoUpdate />
        {children}
      </body>
    </html>
  );
}
