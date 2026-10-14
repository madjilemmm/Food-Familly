// Génère les icônes de l'appli à partir de l'icône Kaddie (node scripts/generate-icons.mjs).
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SOURCE = "assets/kaddie-icon.png"; // carrée, 1024 px, fond plein
const BACKGROUND = "#971cd0"; // violet clair du logo, pour la marge des icônes « maskable »
const OUT = "public/icons";
mkdirSync(OUT, { recursive: true });

const render = (size, file) => sharp(SOURCE).resize(size, size).png().toFile(file);

// "maskable" : le logo réduit à 80 % au centre, pour les icônes découpées en cercle
const maskable = async (size, file) => {
  const inner = Math.round(size * 0.8);
  const logo = await sharp(SOURCE).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 3, background: BACKGROUND } })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(file);
};

// Icône d'onglet Safari : coins arrondis transparents, pour épouser la pastille
// que Safari dessine derrière (sinon un liseré blanc apparaît autour).
const tab = async (size, file) => {
  const r = Math.round(size * 0.22);
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}"/></svg>`);
  await sharp(SOURCE).resize(size, size).composite([{ input: mask, blend: "dest-in" }]).png().toFile(file);
};

// (badge-96.png, la petite icône des notifications Android, garde son dessin.)
await Promise.all([
  render(192, `${OUT}/icon-192.png`),
  render(512, `${OUT}/icon-512.png`),
  maskable(512, `${OUT}/icon-maskable-512.png`),
  tab(32, `${OUT}/favicon-32.png`),
  tab(192, `${OUT}/favicon-192.png`),
  render(180, "public/apple-touch-icon.png"),
]);
console.log("Icônes générées dans", OUT);
