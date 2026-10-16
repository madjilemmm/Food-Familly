import Link from "next/link";
import { Scene, type Illustration } from "@/design-system/components/Kaddie";

/*
 * Briques d'écran Kaddie communes à toute l'appli, construites sur le kit
 * (design-system/) : icônes au trait, en-têtes, messages.
 */

// ─── Icônes (même trait que les icônes du swipe du kit) ────────────────

type IconeProps = { className?: string };

function Trait({ className = "size-7", children }: IconeProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconePanier = (p: IconeProps) => (
  <Trait {...p}>
    <path d="M3 4h2.5l2.2 11h10.6l2-8H7" />
    <circle cx="9" cy="19.5" r="1.4" />
    <circle cx="17" cy="19.5" r="1.4" />
  </Trait>
);

export const IconeCoeur = (p: IconeProps) => (
  <Trait {...p}>
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />
  </Trait>
);

export const IconeAssiette = (p: IconeProps) => (
  <Trait {...p}>
    <circle cx="12" cy="12" r="6.5" />
    <circle cx="12" cy="12" r="3" />
    <path d="M2.5 4v5.5M2.5 13v7M21.5 4c-1.5 1.5-1.5 6 0 7.5V20" />
  </Trait>
);

export const IconeListe = (p: IconeProps) => (
  <Trait {...p}>
    <path d="M4 6.5l1.5 1.5L8 5.5M4 12.5l1.5 1.5L8 11.5M4 18.5l1.5 1.5L8 17.5M11.5 7h8.5M11.5 13h8.5M11.5 19h8.5" />
  </Trait>
);

export const IconeLivre = (p: IconeProps) => (
  <Trait {...p}>
    <path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5v13c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z" />
    <path d="M12 6v13" />
  </Trait>
);

export const IconeSwipe = (p: IconeProps) => (
  <Trait {...p}>
    <rect x="6" y="3.5" width="12" height="16" rx="3" transform="rotate(-8 12 11.5)" />
    <path d="M9.5 11.5l2 2 3.5-4" />
  </Trait>
);

export const IconeReglages = (p: IconeProps) => (
  <Trait {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
  </Trait>
);

export const IconeRetour = (p: IconeProps) => (
  <Trait {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Trait>
);

export const IconePlus = (p: IconeProps) => (
  <Trait {...p}>
    <path d="M12 5v14M5 12h14" />
  </Trait>
);

export const IconeCroix = (p: IconeProps) => (
  <Trait {...p}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </Trait>
);

export const IconeCloche = (p: IconeProps) => (
  <Trait {...p}>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Trait>
);

// ─── En-têtes ──────────────────────────────────────────────────────────

/** Bouton rond vers les réglages ; blanc sur scène, violet sur fond lilas. */
export function LienReglages({ surScene = false }: { surScene?: boolean }) {
  return (
    <Link
      href="/reglages"
      aria-label="Réglages"
      className={`flex size-14 shrink-0 items-center justify-center rounded-full active:scale-95 ${
        surScene ? "bg-blanc text-aubergine" : "bg-surface text-violet"
      }`}
    >
      <IconeReglages />
    </Link>
  );
}

/** En-tête d'un écran calme (fond lilas) : titre BoldenVan aubergine. */
export function EnTete({ titre, sousTitre, reglages = true }: { titre: string; sousTitre?: string; reglages?: boolean }) {
  return (
    <header className="pt-safe flex items-start justify-between gap-4 pb-5">
      <div className="min-w-0 pt-2">
        <h1 className="kd-titre-1 text-aubergine">{titre}</h1>
        {sousTitre && <p className="mt-2 text-encre-douce">{sousTitre}</p>}
      </div>
      {reglages && <LienReglages />}
    </header>
  );
}

/**
 * Fond de l'écran Courses (paniers, caddie, provisions) : par-dessus le motif de la scène.
 * En plein écran, une version en hauteur (l'image, son reflet, l'image) pour ne pas
 * agrandir les dessins ; en bandeau, l'image d'origine en paysage.
 */
export function FondCourses({ format = "portrait" }: { format?: "portrait" | "paysage" }) {
  const src =
    format === "portrait" ? "/brand/fonds/kaddie-motif-courses-violet-portrait.webp" : "/brand/fonds/kaddie-motif-courses-violet.webp";
  // eslint-disable-next-line @next/next/no-img-element -- image de fond statique
  return <img className="kd-motif object-top" src={src} alt="" aria-hidden="true" draggable={false} />;
}

/** En-tête illustré (bandeau horizontal) : étiquette + grand titre blanc. */
export function BandeauScene({
  illustration,
  titre,
  etiquette,
  reglages = true,
  fond,
  children,
}: {
  illustration: Illustration;
  /** Remplace l'illustration par le fond de l'écran Courses. */
  fond?: "courses";
  titre: string;
  etiquette?: React.ReactNode;
  reglages?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Scene
      as="header"
      duo="aubergine"
      // Avec un fond à soi, on ne télécharge pas l'illustration pour rien.
      illustration={fond ? undefined : illustration}
      format="paysage"
      className="pt-safe -mx-5 mb-5 px-5 pb-7"
    >
      {fond === "courses" && <FondCourses format="paysage" />}
      <div className="flex items-start justify-between gap-4 pt-2">
        <div className="min-w-0 pt-4">
          {etiquette && <p className="kd-etiquette mb-2 text-blanc">{etiquette}</p>}
          <h1 className="kd-titre-1">{titre}</h1>
        </div>
        {reglages && <LienReglages surScene />}
      </div>
      {children}
    </Scene>
  );
}

// ─── Messages ──────────────────────────────────────────────────────────

/** Message d'erreur : ce qui s'est passé et quoi faire, sans code technique. */
export function MessageErreur({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-pastille border-[3px] border-aubergine bg-surface px-4 py-3 text-encre">
      {children}
    </p>
  );
}

/** État vide : petite scène, phrase courte en BoldenVan blanc, et une action. */
export function EtatVide({ seed = 5, phrase, children }: { seed?: number; phrase: string; children?: React.ReactNode }) {
  return (
    <Scene duo="aubergine" seed={seed} format="carre" className="flex flex-col gap-5 rounded-carte p-6">
      <p className="kd-titre-2">{phrase}</p>
      {children}
    </Scene>
  );
}

/** Illustration attribuée à un membre, toujours la même selon sa place dans la famille. */
export const ILLUSTRATIONS: Illustration[] = ["courses", "marche", "table"];
export const illustrationDe = (index: number) => ILLUSTRATIONS[index % ILLUSTRATIONS.length];
