import type { NextConfig } from "next";
import { execSync } from "node:child_process";

// Identifiant de la version mise en ligne : sert à recharger l'appli
// installée dès qu'une nouvelle version est disponible.
// Calculé une seule fois (next.config est évalué par plusieurs processus au build).
function buildId(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "local";
  }
}
const BUILD_ID = buildId();

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
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
