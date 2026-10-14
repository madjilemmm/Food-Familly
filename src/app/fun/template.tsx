/** Chaque nouvel écran apparaît en douceur (le template est recréé à chaque navigation). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
