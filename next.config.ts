import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Le service worker doit toujours être revérifié pour que les mises à jour arrivent.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  experimental: {
    // Les photos sont réduites dans le navigateur avant l'envoi (~300 Ko) ;
    // cette limite reste sous celle de Vercel (4,5 Mo).
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
