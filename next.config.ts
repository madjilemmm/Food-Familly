import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Les photos sont réduites dans le navigateur avant l'envoi (~300 Ko) ;
    // cette limite reste sous celle de Vercel (4,5 Mo).
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
