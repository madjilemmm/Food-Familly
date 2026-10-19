"use client";

/**
 * Dernier filet, si même la mise en page de l'appli n'a pas pu s'afficher :
 * une page autonome (couleurs recopiées de tokens.css), avec « Réessayer ».
 */
export default function ErreurGlobale({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 24,
          padding: "48px 24px",
          boxSizing: "border-box",
          background: "#971cd0",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <h1 style={{ fontSize: 40, lineHeight: 1, margin: 0 }}>Oups, ça a coincé</h1>
        <p style={{ fontSize: 17, lineHeight: "24px", margin: 0 }}>Kaddie n&apos;a pas pu s&apos;afficher. Réessaie dans un instant.</p>
        <button
          type="button"
          onClick={() => reset()}
          style={{ minHeight: 56, fontSize: 20, fontWeight: 700, color: "#540472", background: "#ffffff", border: 0, borderRadius: 18 }}
        >
          Réessayer
        </button>
      </body>
    </html>
  );
}
