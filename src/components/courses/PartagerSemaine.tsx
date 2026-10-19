"use client";

import { useState } from "react";

/** Le récap de la semaine (une image) : partagé en un appui, sinon téléchargé. */
export function PartagerSemaine() {
  const [etat, setEtat] = useState<"pret" | "encours" | "erreur">("pret");
  const partager = async () => {
    setEtat("encours");
    try {
      const res = await fetch("/api/recap");
      if (!res.ok) throw new Error();
      const fichier = new File([await res.blob()], "kaddie-semaine.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [fichier] })) {
        await navigator.share({ files: [fichier], title: "Notre semaine sur Kaddie" }).catch(() => {});
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
    <button type="button" onClick={partager} disabled={etat === "encours"} className="min-h-11 font-semibold text-violet underline underline-offset-4">
      {etat === "encours" ? "Je prépare l'image…" : etat === "erreur" ? "Pas de réseau : réessaie" : "Partager notre semaine"}
    </button>
  );
}
