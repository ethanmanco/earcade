import { describe, expect, it } from "vitest";
import {
  bumpStreak,
  dayKey,
  daysBetween,
  emptyStreak,
  levelStats,
  playerLevel,
  streakToday,
  weakestItems,
  xpForLevel,
  xpForRound,
} from "../src/progress/progress";
import { defaults, load, save, type RoundRecord } from "../src/progress/storage";

const rec = (level: RoundRecord["level"], score: number, mode: RoundRecord["mode"] = "intervals"): RoundRecord => ({
  at: 0,
  mode,
  level,
  score,
  total: 10,
  items: {},
});

describe("XP", () => {
  it("pays 10 per right answer, more at harder levels, with a perfect-round bonus", () => {
    expect(xpForRound(rec("beginner", 7))).toBe(70);
    expect(xpForRound(rec("intermediate", 7))).toBe(105);
    expect(xpForRound(rec("professional", 7))).toBe(140);
    expect(xpForRound(rec("master", 7))).toBe(210);
    expect(xpForRound(rec("beginner", 10))).toBe(120);
    expect(xpForRound(rec("master", 0))).toBe(0);
  });

  it("counts Master with extra or no time a little lower", () => {
    expect(xpForRound({ ...rec("master", 8), timer: "off" })).toBe(200);
    expect(xpForRound({ ...rec("master", 8), timer: "double" })).toBe(200);
    expect(xpForRound({ ...rec("master", 8), timer: "normal" })).toBe(240);
  });

  it("levels up at 100, 300, 600 and 1000 XP", () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000]);
    expect(playerLevel(0)).toEqual({ level: 1, into: 0, span: 100 });
    expect(playerLevel(99).level).toBe(1);
    expect(playerLevel(100)).toEqual({ level: 2, into: 0, span: 200 });
    expect(playerLevel(450)).toEqual({ level: 3, into: 150, span: 300 });
  });
});

describe("daily streak", () => {
  it("counts days in a row and remembers the best", () => {
    let s = emptyStreak();
    s = bumpStreak(s, "2026-11-14");
    s = bumpStreak(s, "2026-11-14");
    expect(s.current).toBe(1);
    s = bumpStreak(s, "2026-11-15");
    s = bumpStreak(s, "2026-11-16");
    expect(s).toEqual({ current: 3, best: 3, lastDay: "2026-11-16" });
    s = bumpStreak(s, "2026-11-18");
    expect(s).toEqual({ current: 1, best: 3, lastDay: "2026-11-18" });
  });

  it("crosses months and years", () => {
    expect(daysBetween("2026-11-30", "2026-12-01")).toBe(1);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
    expect(bumpStreak({ current: 4, best: 4, lastDay: "2026-12-31" }, "2027-01-01").current).toBe(5);
  });

  it("shows a streak as alive until a whole day is missed", () => {
    const s = { current: 5, best: 9, lastDay: "2026-11-15" };
    expect(streakToday(s, "2026-11-15")).toEqual({ days: 5, best: 9, playToday: false });
    expect(streakToday(s, "2026-11-16")).toEqual({ days: 5, best: 9, playToday: true });
    expect(streakToday(s, "2026-11-17")).toEqual({ days: 0, best: 9, playToday: true });
    expect(streakToday(emptyStreak(), "2026-11-17").days).toBe(0);
  });

  it("uses the local calendar day", () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(dayKey(new Date(2026, 10, 16, 0, 1))).toBe("2026-11-16");
  });

  it("is saved and loaded, and bad saved values are dropped", () => {
    let stored = "";
    const store = { getItem: () => stored, setItem: (_k: string, v: string) => (stored = v) };
    const d = defaults();
    d.xp = 1234;
    d.streak = { current: 3, best: 7, lastDay: "2026-11-16" };
    save(d, store);
    expect(load(store).xp).toBe(1234);
    expect(load(store).streak).toEqual(d.streak);
    stored = JSON.stringify({ xp: -5, streak: { current: "x", best: 2, lastDay: "yesterday" } });
    expect(load(store).xp).toBe(0);
    expect(load(store).streak).toEqual({ current: 0, best: 2, lastDay: null });
  });
});

describe("stats", () => {
  it("accuracy, best, recent rounds and trend per mode and level", () => {
    const rounds = [rec("beginner", 4), rec("beginner", 6), rec("master", 9), rec("beginner", 8), rec("beginner", 10), rec("beginner", 5, "chords")];
    const s = levelStats(rounds, "intervals", "beginner");
    expect(s.rounds).toBe(4);
    expect(s.accuracy).toBeCloseTo(0.7);
    expect(s.best).toBe(1);
    expect(s.recent).toEqual([0.4, 0.6, 0.8, 1]);
    expect(s.trend).toBeCloseTo(0.4);
    const none = levelStats(rounds, "fretboard", "master");
    expect([none.rounds, none.accuracy, none.best, none.trend]).toEqual([0, null, null, null]);
  });

  it("lists the weakest items with enough tries", () => {
    const w = weakestItems({
      "intervals/beginner/m3": [false, false, true],
      "intervals/beginner/P5": [true, true, true],
      "chords/master/dom13": [false, true, true, true],
      "degrees/master/b6": [false, false],
    });
    expect(w.map((x) => x.key)).toEqual(["intervals/beginner/m3", "chords/master/dom13"]);
    expect(w[0]).toMatchObject({ mode: "intervals", level: "beginner", itemId: "m3", right: 1, total: 3 });
  });
});
