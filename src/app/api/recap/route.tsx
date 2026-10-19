import { ImageResponse } from "next/og";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { getRecapSemaine } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Le récap de la semaine, en image à partager (format portrait, comme une story) :
 * « Cette semaine chez les Martin : tacos, gratin, ramen », aux couleurs de Kaddie.
 */
export async function GET(req: NextRequest) {
  const user = await requireUser();
  const recap = await getRecapSemaine(user.familyId);
  if (!recap) return NextResponse.json({ error: "Pas encore de plats cette semaine" }, { status: 404 });
  const police = await fetch(new URL("/fonts/BoldenVan.ttf", req.url)).then((r) => r.arrayBuffer());
  const logo = new URL("/brand/logo/kaddie-logo-blanc.png", req.url).toString();
  const taille = recap.plats.length > 4 ? 60 : 76;
  const titre = recap.famille.length > 22 ? 76 : 104;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#540472", padding: 96, gap: 56, color: "#ffffff", fontFamily: "BoldenVan" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontSize: 40, letterSpacing: 4, color: "#aaf951" }}>CETTE SEMAINE CHEZ</div>
          <div style={{ fontSize: titre, lineHeight: 1.05 }}>{recap.famille}</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
          {recap.plats.map((p) => (
            <div key={p} style={{ display: "flex", background: "#aaf951", color: "#540472", borderRadius: 48, padding: "22px 44px", fontSize: taille }}>
              {p}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 40, color: "#f6eefb" }}>Choisi ensemble, en un swipe</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={260} height={104} alt="Kaddie" style={{ objectFit: "contain" }} />
        </div>
      </div>
    ),
    { width: 1080, height: 1350, fonts: [{ name: "BoldenVan", data: police, style: "normal", weight: 400 }] },
  );
}
