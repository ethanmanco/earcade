import { describe, expect, it } from "vitest";
import { defaults, historyFor, historyKey, load, save, suggestNext, type RoundRecord } from "../src/progress/storage";

function memory(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_k: string, v: string) => {
      value = v;
    },
  };
}

const round = (level: RoundRecord["level"], score: number): RoundRecord => ({ at: 1, mode: "intervals", level, score, total: 10, items: {} });

describe("storage", () => {
  it("falls back to defaults for missing, broken or blocked storage", () => {
    expect(load(memory())).toEqual(defaults());
    expect(load(memory("{not json"))).toEqual(defaults());
    expect(load(null)).toEqual(defaults());
    const throwing = { getItem: () => { throw new Error("blocked"); } };
    expect(load(throwing)).toEqual(defaults());
    expect(() => save(defaults(), { setItem: () => { throw new Error("full"); } })).not.toThrow();
  });

  it("round-trips saved data", () => {
    const store = memory();
    const d = defaults();
    d.settings.instrument = "guitar";
    d.settings.timer = "off";
    d.history[historyKey("intervals", "master", "P5")] = [true, false];
    d.rounds.push({ ...round("master", 7), items: { P5: [1, 2] }, timer: "off" });
    d.lastLevel.intervals = "master";
    save(d, store);
    expect(load(store)).toEqual(d);
  });

  it("drops bad values", () => {
    const bad = JSON.stringify({
      settings: { instrument: "kazoo", volume: 7, motion: "wild", autoplay: "yes", timer: 3 },
      history: { "intervals/beginner/m3": [true, "x", false] },
      rounds: [{ at: 1, mode: "intervals", level: "beginner", score: 11, total: 10 }, { at: 2, mode: "nope", level: "beginner", score: 1, total: 10 }],
      lastLevel: { intervals: "grandmaster", chords: "beginner" },
    });
    const s = load(memory(bad));
    expect(s.settings).toEqual(defaults().settings);
    expect(s.history["intervals/beginner/m3"]).toEqual([true, false]);
    expect(s.rounds).toEqual([]);
    expect(s.lastLevel).toEqual({ chords: "beginner" });
  });

  it("splits history by mode and level", () => {
    const d = defaults();
    d.history[historyKey("intervals", "beginner", "m3")] = [false];
    d.history[historyKey("intervals", "master", "m3")] = [true];
    expect(historyFor(d, "intervals", "beginner")).toEqual({ m3: [false] });
  });
});

describe("suggested next level", () => {
  it("after 9 of 10, or two 8s in a row", () => {
    expect(suggestNext([round("beginner", 9)], "intervals", "beginner")).toBe("intermediate");
    expect(suggestNext([round("beginner", 8)], "intervals", "beginner")).toBeNull();
    expect(suggestNext([round("beginner", 8), round("beginner", 8)], "intervals", "beginner")).toBe("intermediate");
    expect(suggestNext([round("beginner", 8), round("beginner", 7)], "intervals", "beginner")).toBeNull();
    expect(suggestNext([round("master", 10)], "intervals", "master")).toBeNull();
  });
});
