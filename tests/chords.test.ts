import { Chord, Interval, Note } from "tonal";
import { describe, expect, it } from "vitest";
import {
  CHORD_QUALITIES,
  chordQuality,
  closeVoicing,
  drop2Voicing,
  openVoicing,
  shellVoicing,
  spellQuality,
} from "../src/theory/chordQualities";
import { KEYS } from "../src/theory/keys";
import { noteChroma } from "../src/theory/spelling";
import { BASS_HIGHEST, CHORD_LEVELS, EXTENDED, HIGHEST, LOWEST, SEVENTHS, makeChordQuestion } from "../src/quiz/chords";
import { Rng } from "../src/quiz/rng";
import { LEVEL_IDS } from "../src/quiz/types";

// Written out by hand: semitones above the root for each quality.
const EXPECTED: Record<string, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  maj7: [0, 4, 7, 11],
  dom7: [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  dom9: [0, 4, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  m11: [0, 3, 7, 10, 14, 17],
  dom13: [0, 4, 7, 10, 14, 21],
};

const ROOTS = [...KEYS, "C#", "D#", "Gb", "G#", "A#"];
const pc = (n: number) => ((n % 12) + 12) % 12;
const pcs = (xs: readonly number[]) => [...new Set(xs.map(pc))].sort((a, b) => a - b);

describe("chord table", () => {
  it("has every quality the levels need, once", () => {
    expect(CHORD_QUALITIES.map((q) => q.id)).toEqual(Object.keys(EXPECTED));
  });

  it.each(Object.entries(EXPECTED))("%s has the right notes, and tonal agrees", (id, semis) => {
    const q = chordQuality(id);
    expect([...q.semitones]).toEqual(semis);
    const tonal = Chord.get(`C${q.tonal}`);
    expect(tonal.empty).toBe(false);
    expect(tonal.intervals.map((i) => Interval.semitones(i))).toEqual(semis);
  });

  it("button labels never look alike in an all-capitals font", () => {
    const labels = CHORD_QUALITIES.map((q) => q.label.toUpperCase());
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("only a plain perfect 5th may be left out", () => {
    for (const q of CHORD_QUALITIES) for (const i of q.optional ?? []) expect(q.semitones[i]).toBe(7);
  });
});

describe("spelling every chord in every key", () => {
  for (const root of ROOTS) {
    it(`on ${root}`, () => {
      for (const q of CHORD_QUALITIES) {
        const s = spellQuality(root, q);
        expect(noteChroma(s.root)).toBe(noteChroma(root));
        expect(s.notes).toHaveLength(q.semitones.length);
        s.notes.forEach((n, i) => expect(noteChroma(n)).toBe(pc(noteChroma(s.root) + q.semitones[i]!)));
        for (const n of s.notes) expect(n).not.toMatch(/bb|##/);
        expect(Note.get(s.notes[0]!).letter).toBe(Note.get(s.root).letter);
      }
    });
  }
});

describe("voicings", () => {
  it("inversions put each chord tone in the bass and keep every note", () => {
    for (const q of CHORD_QUALITIES.filter((c) => c.semitones.length <= 4)) {
      for (let inv = 0; inv < q.semitones.length; inv++) {
        for (const v of [closeVoicing(q, inv), drop2Voicing(q, inv)]) {
          expect(pcs(v.offsets)).toEqual(pcs(q.semitones));
          expect(v.offsets).toHaveLength(q.semitones.length);
          expect([...v.offsets]).toEqual([...v.offsets].sort((a, b) => a - b));
          expect(pc(v.offsets[0]!)).toBe(pc(q.semitones[v.inversion]!));
        }
        const close = closeVoicing(q, inv);
        expect(pc(close.offsets[0]!)).toBe(pc(q.semitones[inv]!));
        // Close means within an octave.
        expect(close.offsets[close.offsets.length - 1]! - close.offsets[0]!).toBeLessThan(12);
      }
    }
  });

  it("open and shell voicings keep the root in the bass and every tone but a plain 5th", () => {
    for (const id of EXTENDED) {
      const q = chordQuality(id);
      const open = openVoicing(q);
      const shell = shellVoicing(q);
      expect(pcs(open.offsets)).toEqual(pcs(q.semitones));
      expect(pc(open.offsets[0]!)).toBe(0);
      expect(pc(shell.offsets[0]!)).toBe(0);
      expect(pcs(shell.offsets)).toEqual(pcs(q.semitones.filter((s) => s !== 7)));
    }
  });
});

describe("chord questions", () => {
  for (const level of LEVEL_IDS) {
    const rules = CHORD_LEVELS[level];
    it(`${level}: only asks what the level allows, and asks all of it`, () => {
      const rng = new Rng(4242 + level.length);
      const seen = new Set<string>();
      const kinds = new Set<string>();
      const inversions = new Set<number>();
      for (let n = 0; n < 5000; n++) {
        const item = rules.items[rng.int(rules.items.length)]!;
        const q = makeChordQuestion(level, item, rng);
        const d = q.detail as { root: number; midis: number[]; voicing: string; inversion: number; rootName: string };
        const quality = chordQuality(q.answer);
        expect(rules.items).toContain(q.answer);
        expect(q.choices.map((c) => c.id)).toEqual(CHORD_QUALITIES.filter((c) => rules.items.includes(c.id)).map((c) => c.id));
        // What plays is that chord on that root.
        const want = pcs(quality.semitones.map((s) => d.root + s));
        const heard = pcs(d.midis);
        if (d.voicing === "shell") expect(heard).toEqual(pcs(quality.semitones.filter((s) => s !== 7).map((s) => d.root + s)));
        else expect(heard).toEqual(want);
        expect(q.sound[0]!.midis).toEqual(d.midis);
        expect(noteChroma(d.rootName)).toBe(pc(d.root));
        // In range.
        expect(Math.min(...d.midis)).toBeGreaterThanOrEqual(LOWEST);
        expect(Math.min(...d.midis)).toBeLessThanOrEqual(BASS_HIGHEST);
        expect(Math.max(...d.midis)).toBeLessThanOrEqual(HIGHEST);
        // The bass note is the chord tone the voicing says.
        expect(pc(Math.min(...d.midis))).toBe(pc(d.root + quality.semitones[d.inversion]!));
        if (!rules.voicings) {
          expect(d.voicing).toBe("close");
          expect(d.inversion).toBe(0);
        }
        seen.add(q.answer);
        kinds.add(d.voicing);
        inversions.add(d.inversion);
      }
      expect([...seen].sort()).toEqual([...rules.items].sort());
      if (rules.voicings) {
        expect([...kinds].sort()).toEqual(["close", "drop2", "inversion", "open", "shell"]);
        expect([...inversions].sort()).toEqual([0, 1, 2, 3]);
      }
    });
  }

  it("levels hold exactly the qualities in the brief", () => {
    expect(CHORD_LEVELS.beginner.items).toEqual(["major", "minor"]);
    expect([...CHORD_LEVELS.intermediate.items].sort()).toEqual(["aug", "dim", "major", "minor", "sus2", "sus4"]);
    expect(CHORD_LEVELS.professional.items).toEqual([...SEVENTHS]);
    expect(CHORD_LEVELS.master.items).toEqual([...SEVENTHS, ...EXTENDED]);
    for (const l of LEVEL_IDS) expect(CHORD_LEVELS[l].voicings).toBe(l === "master");
  });

  it("compare plays the other quality on the same root", () => {
    const rng = new Rng(8);
    for (let n = 0; n < 300; n++) {
      const q = makeChordQuestion("intermediate", "major", rng);
      const root = (q.detail as { root: number }).root;
      const other = q.compare!("dim")[0]!.midis;
      expect(pc(other[0]!)).toBe(pc(root));
      expect(pcs(other)).toEqual(pcs([0, 3, 6].map((s) => other[0]! + s)));
    }
  });
});
