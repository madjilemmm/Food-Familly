// Kaddie — maquettes de référence des écrans clés, construites avec les composants du kit.
// Ce fichier sert d'exemple : il montre l'intention visuelle, pas la logique (pas de Supabase, pas d'état).
// Version rendue : exemples/ecrans.html

import * as React from "react";
import { Bouton, CarteRecette, IconeJenVeux, IconePasEnvie, Logo, Scene } from "../components/Kaddie";

const ecran: React.CSSProperties = {
  width: 390,
  height: 844,
  borderRadius: 44,
  overflow: "hidden",
  position: "relative",
  flex: "none",
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box",
  minHeight: 844,
};
const pile: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "var(--espace-4)" };

/* 1. Code famille ------------------------------------------------------- */
export function EcranCode() {
  return (
    <Scene duo="aubergine" seed={9} style={{ ...ecran, padding: "96px 24px 40px", justifyContent: "space-between" }}>
      <div className="kd-monte" style={{ ...pile, alignItems: "center", textAlign: "center", gap: "var(--espace-5)" }}>
        <Logo width={300} />
        <p className="kd-titre-3">Les courses de la famille, en un swipe.</p>
      </div>
      <form className="kd-carte" style={{ padding: "var(--espace-5)", ...pile }}>
        <label htmlFor="code" className="kd-titre-3" style={{ color: "var(--aubergine)" }}>Le code de la famille</label>
        <input id="code" className="kd-champ kd-champ--code" defaultValue="BX7K" autoComplete="off" />
        <Bouton large>C'est parti</Bouton>
      </form>
    </Scene>
  );
}

/* 2. Choix du profil ----------------------------------------------------- */
const PROFILS = [
  { nom: "Maman", duo: "aubergine", illustration: "courses" },
  { nom: "Grand frère", duo: "aubergine", illustration: "marche" },
  { nom: "Petit frère", duo: "aubergine", illustration: "table" },
] as const;

export function EcranProfil() {
  return (
    <div className="kd-app" style={{ ...ecran, padding: "72px 20px 32px", gap: "var(--espace-5)" }}>
      <div style={{ color: "var(--violet)" }}><Logo width={132} /></div>
      <h1 className="kd-titre-1" style={{ color: "var(--aubergine)" }}>C'est qui&nbsp;?</h1>
      <div style={{ ...pile, flex: 1 }}>
        {PROFILS.map((p) => (
          <Scene key={p.nom} as="section" duo={p.duo} illustration={p.illustration} format="paysage"
            style={{ flex: 1, borderRadius: "var(--rayon-l)", display: "flex", alignItems: "flex-end", padding: "var(--espace-5)",
              outline: p.nom === "Maman" ? "4px solid var(--accent)" : undefined, outlineOffset: 3 }}>
            <span className="kd-titre-2">{p.nom}</span>
          </Scene>
        ))}
      </div>
    </div>
  );
}

/* 3. Écran de maman ------------------------------------------------------ */
export function EcranMaman() {
  return (
    <Scene duo="aubergine" seed={4} style={{ ...ecran, padding: "72px 24px 40px", justifyContent: "space-between" }}>
      <div style={pile}>
        <Logo width={120} />
        <h1 className="kd-titre-1">Salut maman&nbsp;!</h1>
      </div>
      <div style={{ ...pile, gap: "var(--espace-3)" }}>
        <Bouton variante="geant" className="kd-pop">Je pars faire les courses</Bouton>
        <p style={{ margin: 0, textAlign: "center", fontWeight: 500 }}>Les garçons reçoivent une notif et choisissent leurs plats.</p>
      </div>
    </Scene>
  );
}

/* 4. Swipe --------------------------------------------------------------- */
export function EcranSwipe() {
  const carte: React.CSSProperties = { position: "absolute", inset: 0 };
  return (
    <Scene duo="aubergine" seed={21} style={{ ...ecran, padding: "64px 20px 32px", gap: "var(--espace-5)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Logo variante="monogramme" width={34} />
        <span className="kd-pastille kd-pastille--match">2 matchs</span>
      </header>
      <p className="kd-titre-2" style={{ margin: 0 }}>Qu'est-ce qui te fait envie ce soir&nbsp;?</p>
      <div style={{ position: "relative", flex: 1 }}>
        <div style={{ ...carte, transform: "rotate(5deg) translateY(12px) scale(0.92)" }}>
          <CarteRecette className="kd-carte--pleine" titre="Pâtes carbonara" infos="20 min · 4 pers." />
        </div>
        <div style={{ ...carte, transform: "rotate(-2deg) translateY(6px) scale(0.96)" }}>
          <CarteRecette className="kd-carte--pleine" titre="Tacos maison" infos="30 min · 4 pers." />
        </div>
        <div style={{ ...carte, transform: "rotate(-4deg) translateX(6px)" }}>
          <CarteRecette className="kd-carte--pleine" titre="Gratin dauphinois" infos="1 h 10 · 4 pers. · 8 ingrédients" pastille="Ton frère aussi" />
          <span className="kd-tampon kd-tampon--like">Miam</span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: "var(--espace-6)" }}>
        <Bouton variante="nope" rond aria-label="Pas envie"><IconePasEnvie /></Bouton>
        <Bouton variante="like" rond aria-label="J'en veux"><IconeJenVeux /></Bouton>
      </div>
    </Scene>
  );
}

/* 5. Match --------------------------------------------------------------- */
export function EcranMatch() {
  return (
    <Scene duo="aubergine" seed={31} style={{ ...ecran, padding: "72px 24px 40px", justifyContent: "space-between", textAlign: "center", gap: "var(--espace-5)" }}>
      <div style={{ ...pile, alignItems: "center", gap: "var(--espace-4)" }}>
        <div className="kd-pop" style={{ color: "var(--accent)" }}><Logo variante="monogramme" width={96} title="" /></div>
        <h1 className="kd-display" style={{ fontSize: 56 }}>C'est un match&nbsp;!</h1>
        <p className="kd-titre-3" style={{ margin: 0 }}>Vous avez choisi le même plat.</p>
      </div>
      <CarteRecette className="kd-monte" titre="Pâtes carbonara" infos="20 min · 4 pers. · 6 ingrédients" style={{ textAlign: "left" }} />
      <Bouton variante="like" large>Ajouter au caddie</Bouton>
    </Scene>
  );
}

/* 6. Liste de courses ---------------------------------------------------- */
const RAYONS = [
  { rayon: "Fruits et légumes", articles: [["Pommes de terre (1,5 kg)", true], ["Oignons", false], ["Citrons", false]] },
  { rayon: "Frais", articles: [["Crème fraîche épaisse", true], ["Lardons", false], ["Parmesan", false]] },
  { rayon: "Épicerie", articles: [["Spaghetti", false], ["Tortillas", false]] },
] as const;

export function EcranListe() {
  return (
    <div className="kd-app" style={{ ...ecran }}>
      <Scene as="header" duo="aubergine" illustration="courses" style={{ padding: "64px 20px 28px", ...pile, gap: "var(--espace-2)" }}>
        <span className="kd-etiquette" style={{ color: "var(--blanc)" }}>Mardi · 3 matchs</span>
        <h1 className="kd-titre-1">Ta liste</h1>
      </Scene>
      <div style={{ padding: "8px 20px 32px", ...pile, gap: "var(--espace-5)", overflow: "hidden" }}>
        {RAYONS.map((r) => (
          <section key={r.rayon}>
            <h2 className="kd-etiquette" style={{ margin: "16px 0 0" }}>{r.rayon}</h2>
            <ul className="kd-liste">
              {r.articles.map(([nom, coche]) => (
                <li key={nom} className="kd-liste__article">
                  <input type="checkbox" className="kd-case" defaultChecked={coche} aria-label={nom} />
                  <span className="kd-liste__texte">{nom}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export function TousLesEcrans() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 32, padding: 32, background: "#1b1320", fontFamily: "var(--police-texte)" }}>
      <EcranCode />
      <EcranProfil />
      <EcranMaman />
      <EcranSwipe />
      <EcranMatch />
      <EcranListe />
    </div>
  );
}
