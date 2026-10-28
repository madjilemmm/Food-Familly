"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { choisirPourLeMenu } from "@/app/actions/trips";
import { RecipeVisual } from "@/components/RecipeVisual";
import { IconeCroix, IconePlus } from "@/components/ui";
import { useErreurReseau } from "@/components/ErreurReseau";

type Plat = { id: string; title: string; photo_url: string | null; infos: string };

/**
 * Les plats du Menu (leurs ingrédients sont sur la liste) et d'autres envies.
 * × retire un plat du Menu, + en ajoute un : la liste suit.
 */
export function PlatsDuMenu({ menu, autres, titreAutres = "Aussi envie" }: { menu: Plat[]; autres: Plat[]; titreAutres?: string }) {
  const [, startTransition] = useTransition();
  // Le plat dont on a touché « × » : « Pas ce soir » ou « Pas pour moi ».
  const [retire, setRetire] = useState<string | null>(null);
  const { essayer, alerte } = useErreurReseau();
  const [etat, appliquer] = useOptimistic({ menu, autres }, (s, c: { plat: Plat; auMenu: boolean; refus: boolean }) =>
    c.auMenu
      ? { menu: [...s.menu, c.plat], autres: s.autres.filter((p) => p.id !== c.plat.id) }
      : c.refus
        ? { menu: s.menu.filter((p) => p.id !== c.plat.id), autres: s.autres.filter((p) => p.id !== c.plat.id) }
        : { menu: s.menu.filter((p) => p.id !== c.plat.id), autres: [c.plat, ...s.autres] },
  );
  const choisir = (plat: Plat, auMenu: boolean, refus = false) =>
    startTransition(async () => {
      setRetire(null);
      appliquer({ plat, auMenu, refus });
      await essayer(() => choisirPourLeMenu(plat.id, auMenu, refus));
    });

  const ligne = (p: Plat, auMenu: boolean) => (
    <li key={p.id} className="border-b-2 border-trait py-2">
      <div className="flex items-center gap-3">
        <Link href={`/recettes/${p.id}?depuis=/menu`} className="flex min-h-14 min-w-0 flex-1 items-center gap-4 active:opacity-80">
          <RecipeVisual recipe={p} taille="vignette" className="size-14 shrink-0 rounded-pastille" />
          <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
            <span className="font-semibold">{p.title}</span>
            {p.infos && <span className="kd-petit">{p.infos}</span>}
          </span>
        </Link>
        <button
          type="button"
          aria-label={auMenu ? `Retirer ${p.title} du Menu` : `Ajouter ${p.title} au Menu`}
          aria-expanded={auMenu ? retire === p.id : undefined}
          onClick={() => (auMenu ? setRetire(retire === p.id ? null : p.id) : choisir(p, true))}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border-[3px] border-trait text-encre-douce active:scale-95"
        >
          {auMenu ? <IconeCroix className="size-5" /> : <IconePlus className="size-5 text-violet" />}
        </button>
      </div>
      {auMenu && retire === p.id && (
        <div className="kd-monte mt-2 flex gap-2">
          <button type="button" onClick={() => choisir(p, false)} className="flex min-h-11 flex-1 items-center justify-center rounded-bouton border-[3px] border-trait bg-surface px-3 font-semibold active:scale-95">
            Pas ce soir
          </button>
          <button type="button" onClick={() => choisir(p, false, true)} className="flex min-h-11 flex-1 items-center justify-center rounded-bouton border-[3px] border-trait bg-surface px-3 font-semibold active:scale-95">
            Pas pour moi
          </button>
        </div>
      )}
    </li>
  );

  return (
    <>
      <section className="mb-10">
        <h2 className="kd-etiquette">Cette semaine</h2>
        {etat.menu.length > 0 ? (
          <>
            <p className="kd-petit mb-2">Leurs ingrédients sont dans le caddie.</p>
            <ul className="kd-liste border-t-2 border-trait">{etat.menu.map((p) => ligne(p, true))}</ul>
          </>
        ) : (
          <p className="kd-petit">Rien pour l&apos;instant : un plat arrive ici quand deux personnes en ont envie (une seule si tu es seul·e).</p>
        )}
      </section>
      {etat.autres.length > 0 && (
        <section className="mb-10">
          <h2 className="kd-etiquette">{titreAutres}</h2>
          <p className="kd-petit mb-2">Touche + pour le mettre au Menu : ses ingrédients arrivent dans le caddie.</p>
          <ul className="kd-liste border-t-2 border-trait">{etat.autres.map((p) => ligne(p, false))}</ul>
        </section>
      )}
      {alerte}
    </>
  );
}
