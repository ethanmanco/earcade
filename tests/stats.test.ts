// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { defaults, type RoundRecord } from "../src/progress/storage";
import { progressPanel, statsPage } from "../src/ui/stats";

const rec = (mode: RoundRecord["mode"], level: RoundRecord["level"], score: number): RoundRecord => ({ at: 0, mode, level, score, total: 10, items: {} });

describe("stats page", () => {
  it("shows every mode and level, with the bars also given as text", () => {
    const d = defaults();
    d.xp = 450;
    d.streak = { current: 3, best: 5, lastDay: "2026-11-16" };
    d.rounds = [rec("intervals", "beginner", 6), rec("intervals", "beginner", 9), rec("fretboard", "master", 4)];
    d.history = { "intervals/beginner/m3": [false, false, true], "fretboard/master/C#": [false, true, false, true] };
    document.body.innerHTML = statsPage(d, "2026-11-16");
    const text = document.body.textContent!.replace(/\s+/g, " ");
    for (const m of ["Intervals", "Chords", "Scale degrees", "Fretboard"]) expect(text).toContain(m);
    expect(document.querySelectorAll(".stat-row")).toHaveLength(16);
    expect(text).toContain("Last 2 rounds, out of 10: 6, 9.");
    expect(text).toContain("75%");
    expect(text).toContain("Not played yet");
    // Weak spots use spoken names: "minor 3rd", "C sharp".
    expect(text).toContain("Minor 3rd");
    expect(text).toContain("C sharp");
    // Bars are hidden from screen readers; the text says the same.
    for (const s of document.querySelectorAll(".spark")) expect(s.getAttribute("aria-hidden")).toBe("true");
  });

  it("progress panel reads the level, XP and streak", () => {
    const d = defaults();
    d.xp = 450;
    d.streak = { current: 3, best: 5, lastDay: "2026-11-15" };
    document.body.innerHTML = progressPanel(d, "2026-11-16");
    const bar = document.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute("aria-valuetext")).toBe("150 of 300 XP toward level 4");
    expect(document.body.textContent).toContain("3 day streak. Play today to keep it going");
    document.body.innerHTML = progressPanel(d, "2026-11-18");
    expect(document.body.textContent).toContain("Start a new streak today. Best: 5 days");
  });
});
