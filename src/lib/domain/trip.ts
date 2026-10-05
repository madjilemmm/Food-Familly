export const TIME_ZONE = "Europe/Paris";

export type DepartureChoice = "30min" | "1h" | "2h" | "soir";

/** Heure du départ "ce soir". */
export const EVENING_HOUR = 18;
/** Passé cette heure, le choix "ce soir" n'est plus proposé. */
export const EVENING_LAST_HOUR = 17;

/** Heure et date "murales" à Paris pour un instant donné. */
export function parisParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** L'instant correspondant à une heure donnée, aujourd'hui, à Paris. */
export function parisTodayAt(hour: number, now: Date = new Date()): Date {
  const p = parisParts(now);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, hour, 0, 0);
  // Décalage Paris/UTC à cet instant (gère l'heure d'été).
  const guess = new Date(wallAsUtc);
  const g = parisParts(guess);
  const offset = Date.UTC(g.year, g.month - 1, g.day, g.hour, g.minute, g.second) - guess.getTime();
  return new Date(wallAsUtc - offset);
}

export function isEveningAvailable(now: Date = new Date()): boolean {
  return parisParts(now).hour < EVENING_LAST_HOUR;
}

export function departureChoices(now: Date = new Date()) {
  const choices: { id: DepartureChoice; label: string }[] = [
    { id: "30min", label: "30 min" },
    { id: "1h", label: "1 heure" },
    { id: "2h", label: "2 heures" },
  ];
  if (isEveningAvailable(now)) choices.push({ id: "soir", label: `Ce soir, ${EVENING_HOUR} h` });
  return choices;
}

export function deadlineFor(choice: DepartureChoice, now: Date = new Date()): Date {
  const MIN = 60 * 1000;
  switch (choice) {
    case "30min":
      return new Date(now.getTime() + 30 * MIN);
    case "1h":
      return new Date(now.getTime() + 60 * MIN);
    case "2h":
      return new Date(now.getTime() + 120 * MIN);
    case "soir":
      if (!isEveningAvailable(now)) throw new Error("Trop tard pour « ce soir »");
      return parisTodayAt(EVENING_HOUR, now);
  }
}

export function isPastDeadline(deadline: string | Date, now: Date = new Date()): boolean {
  return new Date(deadline).getTime() <= now.getTime();
}

/** "14 h 30" à l'heure de Paris. */
export function formatTime(date: string | Date): string {
  const p = parisParts(new Date(date));
  return `${p.hour} h ${String(p.minute).padStart(2, "0")}`;
}

/** Compte à rebours lisible : "1 h 05", "12 min", "45 s". */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "0 min";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")}`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}
