import { describe, expect, it } from "vitest";
import { FLATS, FRETBOARD_LEVELS, NATURALS, SHARPS, makeFretboardQuestion, parsePos, positionsFor, posId } from "../src/quiz/fretboard";
import { Rng } from "../src/quiz/rng";
import { Round } from "../src/quiz/round";
import { LEVEL_IDS } from "../src/quiz/types";

// Written out by hand: standard tuning low to high, and the 12 notes from C.
const OPEN = ["E", "A", "D", "G", "B", "E"];
const CHROMATIC_SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const CHROMATIC_FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

/** The note at a spot, worked out by counting up from the open string. */
function noteAt(string: number, fret: number): [string, string] {
  const i = (CHROMATIC_SHARPS.indexOf(OPEN[string]!) + fret) % 12;
  return [CHROMATIC_SHARPS[i]!, CHROMATIC_FLATS[i]!];
}

describe("every spot on the neck", () => {
  it("is accepted for its note under either spelling, and for no other note", () => {
    const rules = FRETBOARD_LEVELS.master; // all strings, frets 0 to 15
    const all = [...NATURALS, ...SHARPS, ...FLATS];
    for (let s = 0; s < 6; s++) {
      for (let f = 0; f <= 15; f++) {
        const [sharp, flat] = noteAt(s, f);
        for (const name of all) {
          const found = positionsFor(rules, name).some((p) => p.string === s && p.fret === f);
          expect(found, `${name} at string ${s} fret ${f}`).toBe(name === sharp || name === flat);
        }
      }
    }
  });

  it("knows a few spots every guitarist knows", () => {
    const r = FRETBOARD_LEVELS.master;
    const has = (name: string, s: number, f: number) => positionsFor(r, name).some((p) => p.string === s && p.fret === f);
    expect(has("G", 0, 3)).toBe(true);
    expect(has("C", 1, 3)).toBe(true);
    expect(has("A", 3, 2)).toBe(true);
    expect(has("C#", 4, 2)).toBe(true);
    expect(has("Db", 4, 2)).toBe(true);
    expect(has("E", 5, 12)).toBe(true);
    expect(has("Bb", 1, 1)).toBe(true);
  });
});

describe("fretboard questions", () => {
  for (const level of LEVEL_IDS) {
    const rules = FRETBOARD_LEVELS[level];
    it(`${level}: only asks what the level allows, and accepts exactly the right spots`, () => {
      const rng = new Rng(77);
      const seen = new Set<string>();
      for (let n = 0; n < 3000; n++) {
        const item = rules.items[rng.int(rules.items.length)]!;
        const q = makeFretboardQuestion(level, item, rng);
        expect(rules.items).toContain(q.answer);
        expect(q.board).toEqual({ strings: [...rules.strings], frets: [...rules.frets], note: q.answer });
        expect(q.accept!.length).toBeGreaterThan(0);
        // Every accepted spot is in range and plays the note; every spot in range that plays it is accepted.
        const want: string[] = [];
        for (const s of rules.strings) {
          for (let f = rules.frets[0]; f <= rules.frets[1]; f++) if (noteAt(s, f).includes(q.answer)) want.push(`${s}:${f}`);
        }
        expect([...q.accept!].sort()).toEqual(want.sort());
        // What plays after answering is that note.
        const p = parsePos(q.accept![0]!);
        expect(q.reveal[0]!.midis).toEqual([[40, 45, 50, 55, 59, 64][p.string]! + p.fret]);
        seen.add(q.answer);
      }
      expect([...seen].sort()).toEqual([...rules.items].sort());
    });
  }

  it("levels match the brief", () => {
    const b = FRETBOARD_LEVELS.beginner;
    expect([b.items, b.strings, b.frets]).toEqual([[...NATURALS], [0, 1], [0, 5]]);
    const i = FRETBOARD_LEVELS.intermediate;
    expect([i.items, i.strings, i.frets]).toEqual([[...NATURALS], [0, 1, 2, 3, 4, 5], [0, 12]]);
    const p = FRETBOARD_LEVELS.professional;
    expect([p.items.length, p.frets]).toEqual([17, [0, 12]]);
    for (const n of [...SHARPS, ...FLATS]) expect(p.items).toContain(n);
    const m = FRETBOARD_LEVELS.master;
    expect([m.items.length, m.frets, m.timeLimit]).toEqual([17, [0, 15], 6]);
    for (const l of LEVEL_IDS) expect(FRETBOARD_LEVELS[l].timeLimit !== null).toBe(l === "master");
    // Beginner and Intermediate never show a sharp or flat.
    for (const n of [...b.items, ...i.items]) expect(n).not.toMatch(/[#b]/);
  });

  it("any right spot scores; a wrong spot or running out of time does not", () => {
    const round = new Round("fretboard", "intermediate", {}, new Rng(4));
    const q1 = round.current!;
    expect(round.answer(q1.accept!.at(-1)!).correct).toBe(true);
    const q2 = round.current!;
    const wrong = posId({ string: 0, fret: 0 });
    const isRight = q2.accept!.includes(wrong);
    expect(round.answer(wrong).correct).toBe(isRight);
    expect(round.answer(null).correct).toBe(false);
    const s = round.summary();
    expect(s.items.reduce((n, it) => n + it.total, 0)).toBe(3);
  });
});
