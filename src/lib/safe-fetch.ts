import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Téléchargement d'une adresse fournie par un membre de la famille
 * (page de recette, photo). On refuse les adresses internes pour que le
 * serveur ne puisse pas être utilisé pour sonder un réseau privé, et on
 * limite durée et taille.
 */

const BROWSER_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function isPrivateAddress(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 || a === 127 || a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Ce lien n'est pas valide.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Ce lien n'est pas valide.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0) throw new Error("Ce site est introuvable.");
  if (addresses.some(isPrivateAddress)) throw new Error("Ce lien n'est pas autorisé.");
  return url;
}

export async function safeFetch(
  raw: string,
  { maxBytes, accept, timeoutMs = 10_000 }: { maxBytes: number; accept: string; timeoutMs?: number },
): Promise<{ body: Buffer; contentType: string; finalUrl: string }> {
  let url = await assertPublicUrl(raw);
  // Redirections suivies à la main pour revérifier chaque destination.
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": BROWSER_UA, Accept: accept, "Accept-Language": "fr-FR,fr;q=0.9" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await assertPublicUrl(new URL(res.headers.get("location")!, url).href);
      continue;
    }
    if (!res.ok || !res.body) throw new Error(`Le site a répondu ${res.status}.`);

    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("Le fichier est trop lourd.");
      }
      chunks.push(value);
    }
    return { body: Buffer.concat(chunks), contentType: res.headers.get("content-type") ?? "", finalUrl: url.href };
  }
  throw new Error("Trop de redirections.");
}
