import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { apercuInvitation } from "@/lib/apercu";
import { origineDuSite } from "@/lib/origine";
import { texteApercu, titreApercu } from "@/lib/domain/apercu";

export const alt = "Kaddie : l'invitation de la famille";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

/** Une photo que l'aperçu sait dessiner (JPEG ou PNG), en données : sinon rien. */
async function photoEnDonnees(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const type = r.headers.get("content-type") ?? "";
    if (!r.ok || !/image\/(jpeg|png)/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

async function police(): Promise<ArrayBuffer | null> {
  try {
    const r = await fetch(`${origineDuSite(await headers())}/fonts/BoldenVan.ttf`, { signal: AbortSignal.timeout(4000) });
    return r.ok ? await r.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/**
 * L'image du lien d'invitation : le plat de ce soir s'il est décidé, avec son titre ; sinon le nom de la famille sur
 * la scène aubergine. Elle remplace le lien nu dans le groupe de la famille.
 */
export default async function Image({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const apercu = await apercuInvitation(jeton);
  const [photo, gras] = await Promise.all([photoEnDonnees(apercu?.plat?.photo ?? null), police()]);
  const titre = titreApercu(apercu);
  const texte = texteApercu(apercu);
  const police_ = gras ? { fonts: [{ name: "BoldenVan", data: gras, style: "normal" as const, weight: 400 as const }] } : {};
  const famille = gras ? "BoldenVan" : "sans-serif";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#540472", position: "relative" }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- rendu par next/og
          <img src={photo} alt="" width={1200} height={630} style={{ position: "absolute", left: 0, top: 0, width: 1200, height: 630, objectFit: "cover" }} />
        ) : (
          <div style={{ position: "absolute", left: 0, top: 0, width: 1200, height: 630, display: "flex", background: "#971cd0" }}>
            <div style={{ position: "absolute", left: -90, top: 150, width: 420, height: 330, borderRadius: 90, background: "#540472" }} />
            <div style={{ position: "absolute", left: 380, top: -60, width: 400, height: 300, borderRadius: 90, background: "#540472" }} />
            <div style={{ position: "absolute", left: 830, top: 120, width: 460, height: 360, borderRadius: 90, background: "#540472" }} />
            <div style={{ position: "absolute", left: 370, top: 300, width: 370, height: 190, borderRadius: 80, background: "#540472" }} />
          </div>
        )}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", background: "#ffffff", padding: "32px 56px 36px", gap: 8 }}>
          <div style={{ display: "flex", fontFamily: famille, fontSize: 64, lineHeight: 1.05, color: "#540472" }}>{titre}</div>
          <div style={{ display: "flex", fontSize: 30, color: "#6a4479" }}>{texte}</div>
        </div>
        <div style={{ position: "absolute", left: 56, top: 44, display: "flex", fontFamily: famille, fontSize: 56, color: "#ffffff" }}>Kaddie</div>
      </div>
    ),
    { ...size, ...police_ },
  );
}
