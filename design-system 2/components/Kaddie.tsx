"use client";

// Kaddie — composants de marque. Sans dépendance : React + styles/kaddie.css.
// Client Components : utilisables depuis n'importe quelle page, serveur ou client.

import * as React from "react";
import { LOGO_FULL, LOGO_MONOGRAM } from "./logo-paths";
import { motifPath, type Duo, type MotifOptions } from "./motif";

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

/* ---------------------------------------------------------------- Logo */

type LogoProps = {
  /** "complet" = Kaddie ; "monogramme" = « ie » (couteau + fourchette) */
  variante?: "complet" | "monogramme";
  /** largeur en px ou en CSS ; la hauteur suit */
  width?: number | string;
  className?: string;
  /** texte lu par les lecteurs d'écran ; mets "" si le logo est décoratif */
  title?: string;
};

/** Le logo prend la couleur du texte (currentColor) : className="text-blanc" ou style={{color: "var(--aubergine)"}}. */
export function Logo({ variante = "complet", width, className, title = "Kaddie" }: LogoProps) {
  const p = variante === "complet" ? LOGO_FULL : LOGO_MONOGRAM;
  const decoratif = title === "";
  return (
    <svg
      viewBox={`0 0 ${p.width} ${p.height}`}
      width={width}
      className={className}
      role={decoratif ? undefined : "img"}
      aria-hidden={decoratif ? true : undefined}
      aria-label={decoratif ? undefined : title}
      style={{ display: "block", height: "auto", maxWidth: "100%" }}
    >
      <path fill="currentColor" fillRule="evenodd" d={p.d} />
    </svg>
  );
}

/* ---------------------------------------------------------------- Motif & Scène */

type MotifProps = MotifOptions & { className?: string };

/** Le mur de blocs seul. À placer dans un parent en position relative (ou utiliser <Scene>). */
export function Motif({ className, width = 1000, height = 2000, seed = 7, unit, rond }: MotifProps) {
  const d = React.useMemo(() => motifPath({ width, height, seed, unit, rond }), [width, height, seed, unit, rond]);
  return (
    <svg className={cx("kd-motif", className)} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect className="kd-motif__fond" width={width} height={height} />
      <path className="kd-motif__blocs" d={d} />
    </svg>
  );
}

export type Illustration = "courses" | "table" | "marche";

type SceneProps = React.HTMLAttributes<HTMLElement> & {
  duo: Duo;
  /** remplace le motif de blocs par un fond illustré (duo aubergine uniquement) */
  illustration?: Illustration;
  seed?: number;
  /** proportions du dessin du motif : "portrait" (écran plein), "paysage" (bandeau), "carre" */
  format?: "portrait" | "paysage" | "carre";
  /** taille d'un bloc dans le dessin ; plus petit = plus de blocs */
  unit?: number;
  as?: "div" | "section" | "header" | "main";
};

const FORMATS = { portrait: [1000, 2000], paysage: [2000, 1000], carre: [1000, 1000] } as const;

/** Un duo de couleurs + son motif, avec le contenu par-dessus. */
export function Scene({ duo, illustration, seed = 7, format = "portrait", unit, as = "div", className, children, ...rest }: SceneProps) {
  const [w, h] = FORMATS[format];
  const Tag = as;
  return (
    <Tag data-duo={duo} className={cx("kd-scene", className)} {...rest}>
      {illustration ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="kd-motif" src={`/brand/illustrations/kaddie-illustration-${illustration}.svg`} alt="" aria-hidden="true" draggable={false} />
      ) : (
        <Motif width={w} height={h} seed={seed} unit={unit} />
      )}
      {children}
    </Tag>
  );
}

/* ---------------------------------------------------------------- Bouton */

type BoutonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "principal" | "secondaire" | "like" | "nope" | "geant";
  rond?: boolean;
  large?: boolean;
};

/** Bouton Kaddie. Un seul "principal" par écran. Les boutons ronds exigent un aria-label. */
export const Bouton = React.forwardRef<HTMLButtonElement, BoutonProps>(function Bouton(
  { variante = "principal", rond, large, className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        "kd-btn",
        variante === "secondaire" && "kd-btn--secondaire",
        variante === "like" && "kd-btn--like",
        variante === "nope" && "kd-btn--nope",
        variante === "geant" && "kd-btn--geant",
        rond && "kd-btn--rond",
        large && "kd-btn--large",
        className,
      )}
      {...rest}
    />
  );
});

/* ---------------------------------------------------------------- Icônes du swipe */

export function IconeJenVeux() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.5l5 5L19.5 7" />
    </svg>
  );
}

export function IconePasEnvie() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/* ---------------------------------------------------------------- Carte recette */

type CarteRecetteProps = React.HTMLAttributes<HTMLElement> & {
  titre: string;
  /** URL de la photo ; sans photo, un aplat lilas prend la place */
  photo?: string | null;
  /** ex. "1 h 10 · 4 pers. · 8 ingrédients" */
  infos?: string;
  /** ex. "Ton frère aussi" quand l'autre enfant a déjà liké */
  pastille?: string;
};

export function CarteRecette({ titre, photo, infos, pastille, className, ...rest }: CarteRecetteProps) {
  return (
    <article className={cx("kd-carte", className)} {...rest}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="kd-carte__photo" src={photo} alt="" draggable={false} />
      ) : (
        <div className="kd-carte__photo" aria-hidden="true" />
      )}
      <div className="kd-carte__corps">
        {pastille ? <span className="kd-pastille">{pastille}</span> : null}
        <h2 className="kd-carte__titre">{titre}</h2>
        {infos ? <p className="kd-carte__infos">{infos}</p> : null}
      </div>
    </article>
  );
}
