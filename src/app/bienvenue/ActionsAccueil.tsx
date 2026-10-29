"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FamilyCodeForm } from "./FamilyCodeForm";

/**
 * Le bas de l'accueil : « Commencer » est le seul bouton. Qui rejoint une famille depuis un autre téléphone ouvre le
 * champ du code par un lien discret ; l'installation sur l'écran d'accueil n'est jamais demandée ici (voir le Caddie).
 */
export function ActionsAccueil() {
  const [code, setCode] = useState(false);
  const carte = useRef<HTMLDivElement>(null);

  // Le champ est prêt à taper dès qu'il apparaît.
  useEffect(() => {
    if (code) carte.current?.querySelector("input")?.focus();
  }, [code]);

  return (
    <>
      {code ? (
        <div ref={carte} className="kd-carte gap-4 p-6">
          <FamilyCodeForm />
        </div>
      ) : (
        <Link href="/bienvenue/creer" className="kd-btn kd-btn--large bg-blanc! text-aubergine!">
          Commencer
        </Link>
      )}
      <button
        type="button"
        onClick={() => setCode(!code)}
        aria-expanded={code}
        className="mt-1 flex min-h-14 w-full items-center justify-center text-blanc underline underline-offset-4"
      >
        {code ? "Je n'ai pas de code" : "J'ai déjà un code"}
      </button>
    </>
  );
}
