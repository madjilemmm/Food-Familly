import { describe, expect, it } from "vitest";
import { deadlineFor, departureChoices, formatCountdown, formatTime, isPastDeadline, parisTodayAt } from "./trip";

describe("heures à Paris", () => {
  it("18 h en heure d'été = 16 h UTC", () => {
    expect(parisTodayAt(18, new Date("2026-07-10T09:00:00Z")).toISOString()).toBe("2026-07-10T16:00:00.000Z");
  });
  it("18 h en heure d'hiver = 17 h UTC", () => {
    expect(parisTodayAt(18, new Date("2026-12-10T09:00:00Z")).toISOString()).toBe("2026-12-10T17:00:00.000Z");
  });
  it("utilise la date de Paris même près de minuit UTC", () => {
    // 23 h 30 UTC le 10 = 00 h 30 le 11 à Paris (été)
    expect(parisTodayAt(18, new Date("2026-07-10T22:30:00Z")).toISOString()).toBe("2026-07-11T16:00:00.000Z");
  });
  it("formate une heure", () => {
    expect(formatTime("2026-07-10T16:05:00Z")).toBe("18 h 05");
  });
});

describe("départ", () => {
  const morning = new Date("2026-10-05T08:00:00Z"); // 10 h à Paris
  const evening = new Date("2026-10-05T16:00:00Z"); // 18 h à Paris

  it("propose « ce soir » seulement avant 17 h", () => {
    expect(departureChoices(morning).map((c) => c.id)).toEqual(["30min", "1h", "2h", "soir"]);
    expect(departureChoices(evening).map((c) => c.id)).toEqual(["30min", "1h", "2h"]);
    expect(() => deadlineFor("soir", evening)).toThrow();
  });

  it("calcule l'heure limite", () => {
    expect(deadlineFor("30min", morning).toISOString()).toBe("2026-10-05T08:30:00.000Z");
    expect(deadlineFor("2h", morning).toISOString()).toBe("2026-10-05T10:00:00.000Z");
    expect(deadlineFor("soir", morning).toISOString()).toBe("2026-10-05T16:00:00.000Z");
  });

  it("sait si l'heure limite est passée", () => {
    expect(isPastDeadline("2026-10-05T07:59:00Z", morning)).toBe(true);
    expect(isPastDeadline("2026-10-05T08:01:00Z", morning)).toBe(false);
  });

  it("formate le compte à rebours", () => {
    expect(formatCountdown(65 * 60000)).toBe("1 h 05");
    expect(formatCountdown(12 * 60000 + 3000)).toBe("12 min");
    expect(formatCountdown(45000)).toBe("45 s");
    expect(formatCountdown(-1)).toBe("0 min");
  });
});
