"use client";

import { useSyncExternalStore } from "react";
import type { Article } from "@/lib/domain/articles";

/*
 * La file d'attente du téléphone : ce que l'on a fait (cocher, ajouter, swiper) est gardé
 * ici avant d'être envoyé. Sans réseau (en magasin), rien ne saute ni ne se perd : la file
 * part toute seule au retour du réseau (FileAttente). Elle survit à la fermeture de l'appli.
 */

export type Operation =
  | { sorte: "cocher"; trip: string; id: string; checked: boolean }
  | { sorte: "ajouter"; trip: string; id: string; texte: string; source: "manual" | "request"; article: Article; le: string }
  | { sorte: "swipe"; recipeId: string; liked: boolean };

/** Une opération en file ; « envoyee » : partie, l'écran la garde le temps que la page se mette à jour. */
export type Entree = Operation & { cle: string; envoyee?: number };

const STOCKAGE = "kaddie:attente";
const CHANGEMENT = "kaddie:attente";
/** Demande d'envoi immédiat (après une action de l'utilisateur). */
export const ENVOYER = "kaddie:envoyer";
/** Une opération partie depuis ce délai ne sert plus à l'affichage : la page est à jour. */
const GARDE_APRES_ENVOI_MS = 8000;

const cleDe = (op: Operation) =>
  op.sorte === "swipe" ? `swipe:${op.recipeId}` : op.sorte === "cocher" ? `cocher:${op.id}` : `ajouter:${op.id}`;

// La mémoire fait foi ; le stockage du téléphone n'est qu'une copie (il peut manquer, mode privé).
let entrees: Entree[] = [];
let charge = false;
let horsLigne = false;
let instantane = { entrees, horsLigne };

function charger() {
  if (charge || typeof window === "undefined") return;
  charge = true;
  try {
    const brut = localStorage.getItem(STOCKAGE);
    const lu = brut ? JSON.parse(brut) : [];
    if (Array.isArray(lu)) entrees = lu.filter((e) => e && typeof e.cle === "string");
  } catch {
    entrees = [];
  }
  instantane = { entrees, horsLigne };
}

function publier(suivantes: Entree[]) {
  entrees = suivantes;
  instantane = { entrees, horsLigne };
  try {
    localStorage.setItem(STOCKAGE, JSON.stringify(entrees));
  } catch {
    // Stockage indisponible : la file vit en mémoire tant que l'appli est ouverte.
  }
  window.dispatchEvent(new Event(CHANGEMENT));
}

export function lireAttente(): Entree[] {
  charger();
  return entrees;
}

/** Ajoute une opération ; pour un même article ou un même plat, seule la dernière compte. */
export function mettreEnAttente(op: Operation) {
  charger();
  const cle = cleDe(op);
  publier([...entrees.filter((e) => e.cle !== cle), { ...op, cle }]);
  window.dispatchEvent(new Event(ENVOYER));
}

export function retirerDeLAttente(cles: string[]) {
  charger();
  if (cles.some((c) => entrees.some((e) => e.cle === c))) publier(entrees.filter((e) => !cles.includes(e.cle)));
}

export function marquerEnvoyees(cles: string[]) {
  charger();
  const quand = Date.now();
  publier(entrees.map((e) => (cles.includes(e.cle) && !e.envoyee ? { ...e, envoyee: quand } : e)));
}

/** Oublie ce qui est parti depuis un moment (la page affiche déjà ce que dit le serveur). */
export function oublierEnvoyees() {
  charger();
  const limite = Date.now() - GARDE_APRES_ENVOI_MS;
  if (entrees.some((e) => e.envoyee && e.envoyee < limite)) publier(entrees.filter((e) => !e.envoyee || e.envoyee >= limite));
}

export function definirHorsLigne(valeur: boolean) {
  if (valeur === horsLigne) return;
  horsLigne = valeur;
  instantane = { entrees, horsLigne };
  window.dispatchEvent(new Event(CHANGEMENT));
}

const VIDE = { entrees: [] as Entree[], horsLigne: false };
function abonner(rappel: () => void) {
  window.addEventListener(CHANGEMENT, rappel);
  return () => window.removeEventListener(CHANGEMENT, rappel);
}

/** La file et l'état du réseau, pour l'affichage (rendu serveur : file vide). */
export function useAttente() {
  return useSyncExternalStore(
    abonner,
    () => {
      charger();
      return instantane;
    },
    () => VIDE,
  );
}

/** Attend que la file soit partie (avant de finir les courses), au plus quelques secondes. */
export async function attendreFile(maxMs = 6000) {
  const fin = Date.now() + maxMs;
  window.dispatchEvent(new Event(ENVOYER));
  while (lireAttente().some((e) => !e.envoyee) && Date.now() < fin && !horsLigne) {
    await new Promise((r) => setTimeout(r, 200));
  }
}

/** Un identifiant d'article créé sur le téléphone : renvoyer l'ajout deux fois ne le double pas. */
export function nouvelId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  const h = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `${h()}${h()}-${h()}-4${h().slice(1)}-${((8 + Math.random() * 4) | 0).toString(16)}${h().slice(1)}-${h()}${h()}${h()}`;
}
