/**
 * Session familiale : un cookie signé (HMAC-SHA256) qui retient que le code
 * famille a été saisi et, ensuite, quel profil utilise l'appareil.
 *
 * Utilise uniquement Web Crypto pour fonctionner aussi dans le middleware.
 * La clé de signature dépend du code famille : changer FAMILY_CODE
 * déconnecte tous les appareils.
 */

export type Role = "parent" | "child";

export type Session = {
  /** Le code famille a été saisi. */
  family: true;
  profileId: string | null;
  role: Role | null;
  /** Date d'émission (secondes). */
  iat: number;
};

export const SESSION_COOKIE = "ff_session";
/** 400 jours : le maximum accepté par les navigateurs. */
export const SESSION_MAX_AGE = 400 * 24 * 60 * 60;

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function signingSecret(): string {
  const secret = process.env.SESSION_SECRET;
  const code = process.env.FAMILY_CODE;
  if (!secret || !code) {
    throw new Error("SESSION_SECRET et FAMILY_CODE doivent être définis (voir .env.example)");
  }
  return `${secret}:${code}`;
}

async function hmac(data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function encodeSession(session: Session): Promise<string> {
  const payload = base64url(encoder.encode(JSON.stringify(session)));
  const signature = base64url(await hmac(payload));
  return `${payload}.${signature}`;
}

export async function decodeSession(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  try {
    const expected = await hmac(payload);
    if (!timingSafeEqual(expected, fromBase64url(signature))) return null;
    const session = JSON.parse(new TextDecoder().decode(fromBase64url(payload))) as Session;
    if (session.family !== true) return null;
    return session;
  } catch {
    return null;
  }
}

/** Compare deux chaînes en temps constant (pour le code famille). */
export async function safeCompare(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  return timingSafeEqual(new Uint8Array(ha), new Uint8Array(hb));
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};
