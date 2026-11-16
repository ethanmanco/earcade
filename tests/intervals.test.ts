import { Interval, Note } from "tonal";
import { describe, expect, it } from "vitest";
import { INTERVALS, intervalDef, semitonesOf, spellInterval } from "../src/theory/intervals";
import { KEYS } from "../src/theory/keys";
import { noteChroma } from "../src/theory/spelling";
import { HIGH_MIDI, INTERVAL_LEVELS, LOW_MIDI, makeIntervalQuestion } from "../src/quiz/intervals";
import { Rng } from "../src/quiz/rng";
import { LEVEL_IDS } from "../src/quiz/types";

// Written out by hand, independent of the code under test.
const EXPECTED: Record<string, [number, string, number]> = {
  // id: [semitones, name, interval number (letters spanned, counting both ends)]
  m2: [1, "minor 2nd", 2], M2: [2, "major 2nd", 2], m3: [3, "minor 3rd", 3], M3: [4, "major 3rd", 3],
  P4: [5, "perfect 4th", 4], TT: [6, "tritone", 4], P5: [7, "perfect 5th", 5], m6: [8, "minor 6th", 6],
  M6: [9, "major 6th", 6], m7: [10, "minor 7th", 7], M7: [11, "major 7th", 7], P8: [12, "octave", 8],
  m9: [13, "minor 9th", 9], M9: [14, "major 9th", 9], m10: [15, "minor 10th", 10], M10: [16, "major 10th", 10],
  P11: [17, "perfect 11th", 11], A11: [18, "augmented 11th", 11], P12: [19, "perfect 12th", 12],
  m13: [20, "minor 13th", 13], M13: [21, "major 13th", 13], m14: [22, "minor 14th", 14],
  M14: [23, "major 14th", 14], P15: [24, "double octave", 15],
};

const ROOTS = [...KEYS, "C#", "D#", "Gb", "G#", "A#"];
const LETTERS = "CDEFGAB";

describe("interval table", () => {
  it("has every interval from a minor 2nd to a double octave, once", () => {
    expect(INTERVALS.map((i) => i.id)).toEqual(Object.keys(EXPECTED));
    INTERVALS.forEach((iv, i) => expect(iv.semitones).toBe(i + 1));
  });

  it.each(Object.entries(EXPECTED))("%s is %s semitones with the right name", (id, [semis, name]) => {
    const d = intervalDef(id);
    expect(d.semitones).toBe(semis);
    expect(d.name).toBe(name);
    expect(semitonesOf(d.tonal)).toBe(semis);
  });
});

describe("spelling an interval in every key", () => {
  for (const root of ROOTS) {
    it(`from ${root}`, () => {
      for (const def of INTERVALS) {
        const { low, high } = spellInterval(root, def);
        const [semis, , num] = EXPECTED[def.id]!;
        // Same pitch as asked (the root may be respelled, never moved).
        expect(noteChroma(low)).toBe(noteChroma(root));
        // The top note is the right number of semitones up.
        expect((noteChroma(high) - noteChroma(low) + 120) % 12).toBe(semis % 12);
        // And spelled on the right letter: a 3rd spans three letters, and so on.
        const span = (LETTERS.indexOf(Note.get(high).letter) - LETTERS.indexOf(Note.get(low).letter) + 70) % 7;
        expect(span).toBe((num - 1) % 7);
        // Never a double sharp or flat.
        expect(`${low}${high}`).not.toMatch(/bb|##/);
        // tonal agrees on the interval between the spelled notes, within the octave.
        const simple = Interval.get(Interval.distance(low, high));
        expect(((simple.semitones ?? 0) + 120) % 12).toBe(semis % 12);
      }
    });
  }
});

describe("interval questions", () => {
  for (const level of LEVEL_IDS) {
    const rules = INTERVAL_LEVELS[level];
    it(`${level}: only asks what the level allows, and asks all of it`, () => {
      const rng = new Rng(level.length * 977);
      const seenItems = new Set<string>();
      const seenDirs = new Set<string>();
      for (let n = 0; n < 5000; n++) {
        const item = rules.items[rng.int(rules.items.length)]!;
        const q = makeIntervalQuestion(level, item, rng);
        const d = q.detail as { direction: string; low: number; high: number; semitones: number; lowName: string; highName: string };
        expect(rules.items).toContain(q.answer);
        expect(rules.directions).toContain(d.direction);
        expect(q.choices.map((c) => c.id)).toEqual(INTERVALS.filter((i) => rules.items.includes(i.id)).map((i) => i.id));
        // The sound is really that interval, in range, in that direction.
        expect(d.high - d.low).toBe(EXPECTED[q.answer]![0]);
        expect(d.low).toBeGreaterThanOrEqual(LOW_MIDI);
        expect(d.high).toBeLessThanOrEqual(HIGH_MIDI);
        expect(noteChroma(d.lowName)).toBe(d.low % 12);
        expect(noteChroma(d.highName)).toBe(d.high % 12);
        const heard = q.sound.map((s) => s.midis);
        if (d.direction === "up") expect(heard).toEqual([[d.low], [d.high]]);
        if (d.direction === "down") expect(heard).toEqual([[d.high], [d.low]]);
        if (d.direction === "together") expect(heard).toEqual([[d.low, d.high]]);
        seenItems.add(q.answer);
        seenDirs.add(d.direction);
      }
      expect([...seenItems].sort()).toEqual([...rules.items].sort());
      expect([...seenDirs].sort()).toEqual([...rules.directions].sort());
    });
  }

  it("Beginner is exactly m3, M3, P5 and P8, going up", () => {
    expect(INTERVAL_LEVELS.beginner.items).toEqual(["m3", "M3", "P5", "P8"]);
    expect(INTERVAL_LEVELS.beginner.directions).toEqual(["up"]);
  });

  it("Intermediate and Professional stay within an octave; Master goes to two", () => {
    const max = (l: keyof typeof INTERVAL_LEVELS) => Math.max(...INTERVAL_LEVELS[l].items.map((id) => intervalDef(id).semitones));
    expect(INTERVAL_LEVELS.intermediate.items).toHaveLength(12);
    expect(max("intermediate")).toBe(12);
    expect(INTERVAL_LEVELS.intermediate.directions).toEqual(["up"]);
    expect(max("professional")).toBe(12);
    expect(max("master")).toBe(24);
    expect(INTERVAL_LEVELS.master.items).toHaveLength(24);
  });

  it("only Master has a time limit and limited replays", () => {
    for (const level of LEVEL_IDS) {
      const r = INTERVAL_LEVELS[level];
      expect(r.timeLimit !== null).toBe(level === "master");
      expect(Number.isFinite(r.replays)).toBe(level === "master");
    }
  });

  it("compare plays another answer from the same first note", () => {
    const rng = new Rng(5);
    for (let n = 0; n < 200; n++) {
      const q = makeIntervalQuestion("professional", "P5", rng);
      const other = q.compare!("M3");
      expect(other[0]!.midis[0]).toBe(q.sound[0]!.midis[0]);
      const notes = other.flatMap((s) => s.midis);
      expect(Math.max(...notes) - Math.min(...notes)).toBe(4);
    }
  });
});
