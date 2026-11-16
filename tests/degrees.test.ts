import { Note } from "tonal";
import { describe, expect, it } from "vitest";
import {
  DEGREES,
  MAJOR_DEGREES,
  MAJOR_TONICS,
  MINOR_DEGREES,
  MINOR_TONICS,
  cadence,
  spellDegree,
} from "../src/theory/degrees";
import { noteChroma } from "../src/theory/spelling";
import { DEGREE_LEVELS, TONIC_HIGH, TONIC_LOW, makeDegreeQuestion } from "../src/quiz/degrees";
import { Rng } from "../src/quiz/rng";
import { Round } from "../src/quiz/round";
import { LEVEL_IDS } from "../src/quiz/types";
import { prettyNotes, sayNotes } from "../src/ui/notes";

// Written out by hand: semitones above the tonic, named against the major scale.
const EXPECTED: Record<string, number> = { "1": 0, b2: 1, "2": 2, b3: 3, "3": 4, "4": 5, "#4": 6, "5": 7, b6: 8, "6": 9, b7: 10, "7": 11 };
// The natural minor scale, and the major scale, in semitones.
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const pc = (n: number) => ((n % 12) + 12) % 12;

describe("degree table", () => {
  it("has all 12 degrees with the right sizes", () => {
    expect(Object.fromEntries(DEGREES.map((d) => [d.id, d.semitones]))).toEqual(EXPECTED);
  });

  it("major and minor degrees are the major and natural minor scales", () => {
    expect(MAJOR_DEGREES.map((d) => EXPECTED[d])).toEqual(MAJOR);
    expect(MINOR_DEGREES.map((d) => EXPECTED[d])).toEqual(MINOR);
  });

  it("labels like b3 show a flat sign and are read as words, never as a note", () => {
    expect(sayNotes("b3")).toBe("flat 3");
    expect(sayNotes("#4")).toBe("sharp 4");
    expect(sayNotes("In Ab major: C then Eb, 3 then 5")).toBe("In A flat major: C then E flat, 3 then 5");
    expect(prettyNotes("b3")).toContain("♭");
    expect(prettyNotes("Time's up")).toBe("Time&#39;s up");
  });
});

describe("spelling every degree in every key", () => {
  for (const [mode, tonics] of [["major", MAJOR_TONICS], ["minor", MINOR_TONICS]] as const) {
    for (const tonic of tonics) {
      it(`${tonic} ${mode}`, () => {
        for (const d of DEGREES) {
          const name = spellDegree(tonic, d.id, mode);
          const inKey = (mode === "major" ? MAJOR_DEGREES : MINOR_DEGREES).includes(d.id as never);
          if (!inKey) expect(name).not.toMatch(/^(Fb|Cb|E#|B#)$/);
          expect(noteChroma(name)).toBe(pc(noteChroma(tonic) + EXPECTED[d.id]!));
          expect(name).not.toMatch(/bb|##/);
        }
        // The key's own scale is spelled one letter per degree, as written music does.
        const own = (mode === "major" ? MAJOR_DEGREES : MINOR_DEGREES).map((d) => Note.get(spellDegree(tonic, d, mode)).letter);
        expect(new Set(own).size).toBe(7);
      });
    }
  }
});

describe("key-setting progressions", () => {
  it("major is I IV V I, minor is i iv V i", () => {
    const pcs = (c: number[]) => [...new Set(c.map(pc))].sort((a, b) => a - b);
    const major = cadence("major");
    expect(pcs(major[0]!)).toEqual([0, 4, 7]);
    expect(pcs(major[1]!)).toEqual([0, 5, 9]);
    expect(pcs(major[2]!)).toEqual([2, 7, 11]);
    expect(major[3]).toEqual(major[0]);
    const minor = cadence("minor");
    expect(pcs(minor[0]!)).toEqual([0, 3, 7]);
    expect(pcs(minor[1]!)).toEqual([0, 5, 8]);
    expect(pcs(minor[2]!)).toEqual([2, 7, 11]);
    // Each chord has its root in the bass.
    expect(major.map((c) => pc(c[0]!))).toEqual([0, 5, 7, 0]);
  });
});

describe("scale degree questions", () => {
  for (const level of LEVEL_IDS) {
    const rules = DEGREE_LEVELS[level];
    it(`${level}: only asks what the level allows, and asks all of it`, () => {
      const rng = new Rng(31 + level.length);
      const seen = new Set<string>();
      const modes = new Set<string>();
      for (let n = 0; n < 5000; n++) {
        const item = rules.items[rng.int(rules.items.length)]!;
        const q = makeDegreeQuestion(level, item, rng, { history: {} });
        const d = q.detail as { tonic: number; tonicName: string; keyMode: string; midis: number[] };
        const parts = q.parts ?? [q.answer];
        expect(parts).toHaveLength(rules.notes);
        expect(q.answer).toBe(parts.join(" "));
        if (parts.length === 2) expect(parts[0]).not.toBe(parts[1]);
        for (const p of parts) expect(rules.items).toContain(p);
        expect(rules.modes).toContain(d.keyMode);
        expect(q.choices.map((c) => c.id)).toEqual(DEGREES.filter((x) => rules.items.includes(x.id)).map((x) => x.id));
        // The tonic is in range and named right; each note is its degree above the tonic.
        expect(d.tonic).toBeGreaterThanOrEqual(TONIC_LOW);
        expect(d.tonic).toBeLessThanOrEqual(TONIC_HIGH);
        expect(pc(d.tonic)).toBe(noteChroma(d.tonicName));
        parts.forEach((p, i) => expect(pc(d.midis[i]! - d.tonic)).toBe(EXPECTED[p]));
        // What plays: four chords that set this key, then the note(s).
        const chords = q.sound.slice(0, 4);
        const notes = q.sound.slice(4);
        cadence(d.keyMode as "major" | "minor").forEach((c, i) => expect(chords[i]!.midis).toEqual(c.map((o) => d.tonic + o)));
        expect(notes.map((s) => s.midis[0])).toEqual(d.midis);
        expect(notes[0]!.at).toBeGreaterThan(chords[3]!.at);
        // Master replays only the notes; other levels replay the whole thing.
        if (rules.contextOnce) expect(q.replay!.map((s) => s.midis[0])).toEqual(d.midis);
        else expect(q.replay).toBeUndefined();
        for (const p of parts) seen.add(p);
        modes.add(d.keyMode);
      }
      expect([...seen].sort()).toEqual([...rules.items].sort());
      expect([...modes].sort()).toEqual([...rules.modes].sort());
    });
  }

  it("levels hold exactly what the brief says", () => {
    expect(DEGREE_LEVELS.beginner.items).toEqual(["1", "3", "5"]);
    expect(DEGREE_LEVELS.beginner.modes).toEqual(["major"]);
    expect(DEGREE_LEVELS.intermediate.items).toEqual([...MAJOR_DEGREES]);
    expect(DEGREE_LEVELS.intermediate.modes).toEqual(["major"]);
    expect(DEGREE_LEVELS.professional.items).toHaveLength(12);
    expect(DEGREE_LEVELS.professional.modes).toEqual(["major", "minor"]);
    const m = DEGREE_LEVELS.master;
    expect([m.keyEachQuestion, m.notes, m.contextOnce]).toEqual([true, 2, true]);
    for (const l of ["beginner", "intermediate", "professional"] as const) {
      expect([DEGREE_LEVELS[l].keyEachQuestion, DEGREE_LEVELS[l].notes, DEGREE_LEVELS[l].contextOnce]).toEqual([false, 1, false]);
    }
  });

  it("one key per round below Master, new keys at Master", () => {
    for (let seed = 0; seed < 50; seed++) {
      const r = new Round("degrees", "intermediate", {}, new Rng(seed));
      expect(new Set(r.questions.map((q) => q.tag)).size).toBe(1);
    }
    let varied = 0;
    for (let seed = 0; seed < 50; seed++) {
      const r = new Round("degrees", "master", {}, new Rng(seed));
      if (new Set(r.questions.map((q) => q.tag)).size > 1) varied++;
    }
    expect(varied).toBe(50);
  });

  it("scores two-note phrases only when both are right, and counts each note", () => {
    const r = new Round("degrees", "master", {}, new Rng(3));
    const q1 = r.current!;
    const [a, b] = q1.parts!;
    r.answer(`${a} ${b}`);
    const q2 = r.current!;
    const [c] = q2.parts!;
    const wrong = q2.choices.find((x) => x.id !== q2.parts![1] && x.id !== c)!.id;
    const ans = r.answer(`${c} ${wrong}`);
    expect(ans.correct).toBe(false);
    expect(ans.parts.map((p) => p.correct)).toEqual([true, false]);
    expect(r.score).toBe(1);
    const s = r.summary();
    expect(s.items.reduce((n, it) => n + it.total, 0)).toBe(4);
    expect(s.items.reduce((n, it) => n + it.right, 0)).toBe(3);
  });
});
