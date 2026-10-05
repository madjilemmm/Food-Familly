// Génère les icônes de l'appli à partir d'un SVG (node scripts/generate-icons.mjs).
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const OUT = "public/icons";
mkdirSync(OUT, { recursive: true });

// Assiette blanche sur fond tomate, avec un cœur : « à table, en famille ».
const icon = (padding) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#f0573c"/>
  <g transform="translate(256 256) scale(${1 - padding}) translate(-256 -256)">
    <circle cx="256" cy="256" r="170" fill="#fff8f0"/>
    <circle cx="256" cy="256" r="128" fill="none" stroke="#ffd9cf" stroke-width="10"/>
    <path d="M256 326 C 196 286 166 258 166 222 C 166 196 186 176 212 176 C 232 176 248 188 256 204 C 264 188 280 176 300 176 C 326 176 346 196 346 222 C 346 258 316 286 256 326 Z" fill="#f0573c"/>
    <rect x="48" y="150" width="20" height="212" rx="10" fill="#fff8f0"/>
    <rect x="444" y="150" width="20" height="212" rx="10" fill="#fff8f0"/>
  </g>
</svg>`;

// Badge monochrome (petite icône dans la barre de notifications Android)
const badge = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <path d="M48 80 C 26 64 14 52 14 37 C 14 26 22 18 33 18 C 40 18 45 22 48 28 C 51 22 56 18 63 18 C 74 18 82 26 82 37 C 82 52 70 64 48 80 Z" fill="#fff"/>
</svg>`;

const render = (svg, size, file) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(`${OUT}/${file}`);

await Promise.all([
  render(icon(0), 192, "icon-192.png"),
  render(icon(0), 512, "icon-512.png"),
  // "maskable" : marge de sécurité pour les icônes découpées en cercle
  render(icon(0.2), 512, "icon-maskable-512.png"),
  render(icon(0), 32, "favicon-32.png"),
  render(badge, 96, "badge-96.png"),
]);
await sharp(Buffer.from(icon(0))).resize(180, 180).png().toFile("public/apple-touch-icon.png");
console.log("Icônes générées dans", OUT);
