"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// La page d'avant, dans cette visite de l'appli (vide après un rechargement).
let precedente: string | null = null;
let actuelle: string | null = null;

/** Retient la page précédente à chaque navigation (monté une fois, dans la mise en page racine). */
export function SuiviNavigation() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname !== actuelle) {
      precedente = actuelle;
      actuelle = pathname;
    }
  }, [pathname]);
  return null;
}

/**
 * « ‹ Les recettes » : si l'on vient de cette page, un vrai retour en arrière, qui
 * retrouve la place dans la liste ; sinon (lien ouvert directement), un lien normal.
 */
export function LienRetour({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        if (precedente && precedente === new URL(href, location.origin).pathname) {
          e.preventDefault();
          router.back();
        }
      }}
    >
      {children}
    </Link>
  );
}
