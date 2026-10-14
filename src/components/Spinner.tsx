/** Petit indicateur d'attente, hérite de la couleur du texte. */
export function Spinner({ className = "size-6" }: { className?: string }) {
  return (
    <span
      aria-label="Chargement"
      role="status"
      className={`inline-block animate-spin rounded-full border-[3px] border-current border-r-transparent align-middle ${className}`}
    />
  );
}
