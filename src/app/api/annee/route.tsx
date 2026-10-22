import { ImageResponse } from "next/og";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAnnee } from "@/lib/data";

export const dynamic = "force-dynamic";

/** « Notre année à table », en image à partager (format story), aux couleurs de Kaddie. */
export async function GET(req: NextRequest) {
  const user = await requireUser();
  const annee = await getAnnee(user.familyId);
  if (!annee || annee.courses === 0) return NextResponse.json({ error: "Pas encore de courses cette année" }, { status: 404 });
  const police = await fetch(new URL("/fonts/BoldenVan.ttf", req.url)).then((r) => r.arrayBuffer());
  const logo = new URL("/brand/logo/kaddie-logo-blanc.png", req.url).toString();
  const nom = (id: string) => annee.noms.get(id) ?? "Quelqu'un";
  const lignes = [
    { chiffre: String(annee.diners), phrase: "plats choisis ensemble" },
    annee.platStar && { chiffre: annee.titres.get(annee.platStar.id) ?? "", phrase: "le plat de l'année" },
    annee.duo && { chiffre: `${nom(annee.duo.a)} & ${nom(annee.duo.b)}`, phrase: "le duo de l'année" },
    annee.champion && { chiffre: nom(annee.champion.id), phrase: annee.champion.fois > 1 ? `${annee.champion.fois} courses faites` : "a fait les courses" },
  ].filter((l): l is { chiffre: string; phrase: string } => Boolean(l));
  const titre = annee.famille.length > 22 ? 72 : 96;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#540472", padding: 96, gap: 48, color: "#ffffff", fontFamily: "BoldenVan" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 40, letterSpacing: 4, color: "#aaf951" }}>{`NOTRE ANNÉE ${annee.an} À TABLE`}</div>
          <div style={{ fontSize: titre, lineHeight: 1.05 }}>{annee.famille}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
          {lignes.map((l) => (
            <div key={l.phrase} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: l.chiffre.length > 18 ? 56 : 76, color: "#aaf951", lineHeight: 1.05 }}>{l.chiffre}</div>
              <div style={{ fontSize: 36, color: "#f6eefb" }}>{l.phrase}</div>
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
