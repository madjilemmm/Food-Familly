"use client";

import { useState } from "react";

/** Le récap de la semaine (une image) : partagé en un appui, sinon téléchargé. */
export function PartagerSemaine({
  url = "/api/recap",
  nom = "kaddie-semaine.png",
  titre = "Notre semaine sur Kaddie",
  libelle = "Partager notre semaine",
  className = "min-h-11 font-semibold text-violet underline underline-offset-4",
}: {
  url?: string;
  nom?: string;
  titre?: string;
  libelle?: string;
  className?: string;
}) {
  const [etat, setEtat] = useState<"pret" | "encours" | "erreur">("pret");
  const partager = async () => {
    setEtat("encours");
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const fichier = new File([await res.blob()], nom, { type: "image/png" });
      if (navigator.canShare?.({ files: [fichier] })) {
        await navigator.share({ files: [fichier], title: titre }).catch(() => {});
      } else {
        const lien = document.createElement("a");
        lien.href = URL.createObjectURL(fichier);
        lien.download = fichier.name;
        lien.click();
        URL.revokeObjectURL(lien.href);
      }
      setEtat("pret");
    } catch {
      setEtat("erreur");
    }
  };
  return (
    <button type="button" onClick={partager} disabled={etat === "encours"} className={className}>
      {etat === "encours" ? "Je prépare l'image…" : etat === "erreur" ? "Pas de réseau : réessaie" : libelle}
    </button>
  );
}
