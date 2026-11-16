// @vitest-environment happy-dom
// The round screen with the sound stubbed out: after answering, every replay
// must play the question that was just answered, never the next one.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioStep } from "../src/quiz/types";

const played: AudioStep[][] = [];
vi.mock("../src/audio/instrument", () => ({
  instrument: {
    play: vi.fn(async (steps: AudioStep[]) => {
      played.push(steps);
    }),
    ensureReady: vi.fn(async () => undefined),
    isLoaded: () => true,
    stop: vi.fn(),
  },
}));
vi.mock("../src/audio/sfx", () => ({ sfx: { correct() {}, wrong() {}, tick() {}, fanfare() {} } }));

const { RoundView } = await import("../src/ui/roundView");
const { Round } = await import("../src/quiz/round");
const { Rng } = await import("../src/quiz/rng");
const { defaultSettings } = await import("../src/progress/storage");

const flush = () => new Promise((r) => setTimeout(r, 0));

async function setup(mode: "intervals" | "chords" | "degrees", level: "beginner" | "master", autoplay = false) {
  played.length = 0;
  const round = new Round(mode, level, {}, new Rng(12));
  const settings = { ...defaultSettings(), autoplay };
  const view = new RoundView(round, { settings: () => settings, announce() {}, onAnswer() {}, onDone() {}, onQuit() {} });
  document.body.replaceChildren(view.el);
  view.start();
  return { round, view };
}

const click = (el: Element | null) => (el as HTMLElement).click();

describe("round screen replays", () => {
  beforeEach(() => vi.useRealTimers());

  for (const mode of ["intervals", "chords", "degrees"] as const) {
    it(`${mode}: Hear it again and Hear yours play the answered question`, async () => {
      const { round } = await setup(mode, "beginner");
      for (let i = 0; i < 3; i++) {
        const q = round.questions[i]!;
        click(document.querySelector('[data-act="main"]'));
        await flush();
        expect(played.at(-1)).toEqual(q.sound);
        // Answer wrong, so Hear yours appears.
        const wrong = q.choices.find((c) => c.id !== q.answer)!;
        click(document.querySelector(`.answer[data-choice="${wrong.id}"]`));
        expect(round.current).toBe(round.questions[i + 1]);

        click(document.querySelector('[data-act="again"]'));
        await flush();
        expect(played.at(-1)).toEqual(q.reveal);

        click(document.querySelector('[data-act="yours"]'));
        await flush();
        expect(played.at(-1)).toEqual(q.compare!(wrong.id));

        click(document.querySelector('[data-act="main"]'));
        await flush();
      }
    });
  }

  it("a miss replays the right answer on its own when auto-play is on", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { round } = await setup("intervals", "beginner", true);
    const q = round.questions[0]!;
    await vi.advanceTimersByTimeAsync(500);
    expect(played.at(-1)).toEqual(q.sound);
    const wrong = q.choices.find((c) => c.id !== q.answer)!;
    const before = played.length;
    click(document.querySelector(`.answer[data-choice="${wrong.id}"]`));
    await vi.advanceTimersByTimeAsync(700);
    // Exactly one more clip, and it is this question's answer (intervals reveal = what was asked).
    expect(played.length).toBe(before + 1);
    expect(played.at(-1)).toEqual(q.reveal);
  });

  it("Scale degrees Master replays only the notes, and Hear yours plays both picks", async () => {
    const { round } = await setup("degrees", "master");
    const q = round.questions[0]!;
    click(document.querySelector('[data-act="main"]'));
    await flush();
    expect(played.at(-1)).toEqual(q.sound);
    click(document.querySelector('[data-act="main"]'));
    await flush();
    expect(played.at(-1)).toEqual(q.replay);
    const [a] = q.parts!;
    const other = q.choices.find((c) => !q.parts!.includes(c.id))!.id;
    click(document.querySelector(`.answer[data-choice="${a}"]`));
    click(document.querySelector(`.answer[data-choice="${other}"]`));
    click(document.querySelector('[data-act="yours"]'));
    await flush();
    expect(played.at(-1)).toEqual(q.compare!(`${a} ${other}`));
    click(document.querySelector('[data-act="again"]'));
    await flush();
    expect(played.at(-1)).toEqual(q.reveal);
  });
});
