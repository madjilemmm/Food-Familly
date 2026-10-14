/* Kaddie — preset Tailwind v3. Dans tailwind.config.(js|ts) :
     presets: [require("./design-system/tokens/tailwind-v3.preset.js")],
   Les valeurs pointent vers les variables de tokens.css (à importer dans globals.css). */

const v = (name) => `var(--${name})`;

module.exports = {
  theme: {
    extend: {
      colors: {
        violet: v("violet"),
        aubergine: v("aubergine"),
        pistache: v("pistache"),
        blanc: v("blanc"),
        accent: { DEFAULT: v("accent"), on: v("on-accent") },
        lilas: v("lilas"),
        encre: { DEFAULT: v("encre"), douce: v("encre-douce") },
        trait: v("trait"),
        fond: v("fond"),
        surface: v("surface"),
        action: { DEFAULT: v("action"), on: v("on-action") },
        like: { DEFAULT: v("like"), on: v("on-like") },
        nope: { DEFAULT: v("nope"), on: v("on-nope") },
        match: { DEFAULT: v("match"), on: v("on-match") },
        focus: v("focus"),
      },
      fontFamily: {
        display: [v("police-display")],
        sans: [v("police-texte")],
      },
      fontSize: {
        display: [v("taille-display"), { lineHeight: v("interligne-display") }],
        "titre-1": [v("taille-titre-1"), { lineHeight: v("interligne-titre-1") }],
        "titre-2": [v("taille-titre-2"), { lineHeight: v("interligne-titre-2") }],
        "titre-3": [v("taille-titre-3"), { lineHeight: v("interligne-titre-3") }],
        bouton: [v("taille-bouton"), { lineHeight: v("interligne-bouton") }],
        corps: [v("taille-corps"), { lineHeight: v("interligne-corps") }],
        petit: [v("taille-petit"), { lineHeight: v("interligne-petit") }],
        etiquette: [v("taille-etiquette"), { lineHeight: v("interligne-etiquette"), letterSpacing: "0.06em" }],
      },
      borderRadius: {
        pastille: v("rayon-s"),
        bouton: v("rayon-m"),
        carte: v("rayon-l"),
      },
      transitionTimingFunction: {
        sortie: v("courbe-sortie"),
        rebond: v("courbe-rebond"),
      },
    },
  },
};
