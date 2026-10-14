/** Les 3 gestes pour installer l'appli sur l'écran d'accueil d'un iPhone. */
export function InstallHelp() {
  const etapes = [
    <>
      Dans Safari, touche <strong>Partager</strong> en bas de l&apos;écran.
    </>,
    <>
      Choisis <strong>« Sur l&apos;écran d&apos;accueil »</strong>.
    </>,
    <>
      Touche <strong>Ajouter</strong>, puis ouvre Kaddie depuis sa nouvelle icône.
    </>,
  ];
  return (
    <ol className="flex flex-col gap-3">
      {etapes.map((e, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-pastille bg-accent font-display text-on-accent">
            {i + 1}
          </span>
          <span>{e}</span>
        </li>
      ))}
    </ol>
  );
}
