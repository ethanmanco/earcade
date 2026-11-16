import { describe, expect, it } from "vitest";
import { itemWeight, pickItems, recordResult, HISTORY_LENGTH } from "../src/quiz/adaptive";
import { Rng } from "../src/quiz/rng";
import { Round, ROUND_LENGTH } from "../src/quiz/round";
import type { ItemHistory } from "../src/quiz/types";

describe("adaptive picking", () => {
  it("weights missed items higher", () => {
    expect(itemWeight([true, true, true])).toBe(1);
    expect(itemWeight([false, false])).toBe(4);
    expect(itemWeight(undefined)).toBe(1.5);
  });

  it("asks missed items more often", () => {
    const items = ["a", "b", "c", "d", "e", "f"];
    const history: ItemHistory = {};
    for (const id of items) history[id] = Array(10).fill(id !== "c");
    const counts: Record<string, number> = {};
    const rng = new Rng(1);
    for (let r = 0; r < 500; r++) for (const id of pickItems(items, history, rng)) counts[id] = (counts[id] ?? 0) + 1;
    for (const id of items.filter((i) => i !== "c")) expect(counts.c!).toBeGreaterThan(counts[id]! * 1.5);
  });

  it("caps repeats and never asks one item three times in a row", () => {
    const rng = new Rng(2);
    const history: ItemHistory = { a: Array(20).fill(false) };
    for (let r = 0; r < 500; r++) {
      const picks = pickItems(["a", "b", "c", "d", "e"], history, rng);
      expect(picks).toHaveLength(10);
      expect(picks.filter((p) => p === "a").length).toBeLessThanOrEqual(3);
      for (let i = 2; i < picks.length; i++) expect(picks[i] === picks[i - 1] && picks[i] === picks[i - 2]).toBe(false);
    }
  });

  it("fills a round from a tiny pool", () => {
    const picks = pickItems(["x", "y"], {}, new Rng(3));
    expect(picks).toHaveLength(10);
    expect(new Set(picks)).toEqual(new Set(["x", "y"]));
  });

  it("keeps only recent history", () => {
    const h: ItemHistory = {};
    for (let i = 0; i < 50; i++) recordResult(h, "a", i % 2 === 0);
    expect(h.a).toHaveLength(HISTORY_LENGTH);
  });
});

describe("a round", () => {
  it("has 10 questions and scores answers", () => {
    const round = new Round("intervals", "beginner", {}, new Rng(9));
    expect(round.questions).toHaveLength(ROUND_LENGTH);
    let i = 0;
    while (!round.done) {
      const q = round.current!;
      round.answer(i++ % 2 === 0 ? q.answer : null);
    }
    const s = round.summary();
    expect(s.score).toBe(5);
    expect(s.total).toBe(10);
    expect(s.items.reduce((n, it) => n + it.total, 0)).toBe(10);
    expect(s.items.reduce((n, it) => n + it.right, 0)).toBe(5);
    for (const p of s.practice) expect(p.right).toBeLessThan(p.total);
    expect(s.items[0]!.spoken).toMatch(/3rd|5th|octave/);
  });
});
