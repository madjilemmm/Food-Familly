/** Les 3 gestes pour installer l'appli sur l'écran d'accueil d'un iPhone. */
export function InstallHelp() {
  return (
    <ol className="space-y-2 text-base">
      <li>
        1. Dans Safari, touchez <strong>Partager</strong>{" "}
        <span aria-hidden className="inline-block rounded border border-current px-1 text-sm">
          ⬆︎
        </span>{" "}
        en bas de l&apos;écran.
      </li>
      <li>
        2. Choisissez <strong>« Sur l&apos;écran d&apos;accueil »</strong>.
      </li>
      <li>
        3. Touchez <strong>Ajouter</strong>, puis ouvrez l&apos;appli depuis sa nouvelle icône.
      </li>
    </ol>
  );
}
