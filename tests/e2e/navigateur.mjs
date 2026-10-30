// Le navigateur des essais : Chromium par défaut ; NAVIGATEUR=webkit (le moteur de Safari) ou firefox pour les autres.
// CHROMIUM_PATH : un Chromium déjà installé (sinon celui de Playwright, ou /opt/pw-browsers/chromium s'il existe).
import fs from "node:fs";
import { chromium, firefox, webkit } from "@playwright/test";

export async function lancer() {
  const moteur = process.env.NAVIGATEUR ?? "chromium";
  if (moteur === "webkit") return webkit.launch();
  if (moteur === "firefox") return firefox.launch();
  const executablePath = process.env.CHROMIUM_PATH ?? (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
  return chromium.launch(executablePath ? { executablePath } : {});
}
