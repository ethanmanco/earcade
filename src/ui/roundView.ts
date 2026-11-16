// The round screen: play, answer, hear the right answer, next. The quiz logic
// lives in ../quiz; this file only draws it and wires up taps, keys and sound.

import { instrument } from "../audio/instrument";
import { sfx } from "../audio/sfx";
import type { Settings } from "../progress/storage";
import { modeInfo, modeRules } from "../quiz/modes";
import type { Round } from "../quiz/round";
import { LEVEL_NAMES, type AudioStep, type Question } from "../quiz/types";
import { esc } from "./html";
import { sprite } from "./sprites";

export interface RoundHooks {
  settings(): Settings;
  /** Called once per answered question. */
  onAnswer(q: Question, correct: boolean): void;
  onDone(round: Round): void;
  onQuit(): void;
  announce(text: string): void;
}

type Phase = "ready" | "feedback";

const TIMER_MULT = { normal: 1, double: 2, off: 0 } as const;

export class RoundView {
  readonly el: HTMLElement;
  private phase: Phase = "ready";
  /** The question has been played at least once (answers unlock). */
  private heard = false;
  private replaysUsed = 0;
  private playing = false;
  private timerId: number | null = null;
  private autoplayId: number | null = null;
  private chosen: string | null = null;
  private readonly onKey = (e: KeyboardEvent) => this.key(e);
  private readonly rules;

  constructor(
    private round: Round,
    private hooks: RoundHooks,
  ) {
    this.rules = modeRules(round.mode, round.level);
    this.el = document.createElement("div");
    this.el.className = "screen";
    const timerPref = hooks.settings().timer;
    const untimed = this.rules.timeLimit !== null && timerPref === "off";
    this.el.innerHTML = `
      <header class="topbar">
        <button class="icon-btn" type="button" data-act="quit" aria-label="Quit round">${sprite("close", 3)}</button>
        <h1 class="title title--small" tabindex="-1">
          <span>${esc(modeInfo(round.mode).name)}</span>
          <span class="title-sub">${LEVEL_NAMES[round.level]}${untimed ? " (untimed)" : timerPref === "double" && this.rules.timeLimit ? " (double time)" : ""}</span>
        </h1>
        <div class="topbar-end"><span class="counter"></span></div>
      </header>
      <ol class="pips" aria-hidden="true">${round.questions.map(() => `<li class="pip"></li>`).join("")}</ol>
      <div class="stage" tabindex="-1"></div>
      <div class="answers" role="group" aria-label="Answers"></div>
      <button class="btn btn--go main-btn" type="button" data-act="main"></button>`;
    this.el.addEventListener("click", (e) => this.click(e));
    document.addEventListener("keydown", this.onKey);
  }

  start(): void {
    this.showQuestion();
  }

  destroy(): void {
    this.stopTimer();
    if (this.autoplayId !== null) window.clearTimeout(this.autoplayId);
    instrument.stop();
    document.removeEventListener("keydown", this.onKey);
  }

  // ---------------------------------------------------------------- drawing

  private q(): Question {
    return this.round.current ?? this.round.questions[this.round.questions.length - 1]!;
  }

  private $(sel: string): HTMLElement {
    return this.el.querySelector<HTMLElement>(sel)!;
  }

  private showQuestion(): void {
    const q = this.q();
    const n = this.round.index + 1;
    const total = this.round.questions.length;
    this.phase = "ready";
    this.heard = false;
    this.replaysUsed = 0;
    this.chosen = null;
    this.$(".counter").innerHTML = `<span aria-hidden="true">${n}/${total}</span><span class="sr-only">Question ${n} of ${total}</span>`;
    this.el.querySelectorAll(".pip").forEach((p, i) => p.classList.toggle("is-now", i === this.round.index));

    const answers = this.$(".answers");
    answers.dataset.count = String(q.choices.length > 12 ? 24 : q.choices.length > 6 ? 12 : q.choices.length);
    answers.className = "answers is-waiting";
    answers.innerHTML = q.choices
      .map((c, i) => {
        const key = i < 9 ? String(i + 1) : i === 9 ? "0" : "";
        return `<button class="answer" type="button" data-choice="${esc(c.id)}" aria-disabled="true"
          aria-label="${esc(c.spoken)}${q.choices.length > 12 ? `, ${esc(c.label)}` : ""}"${key ? ` aria-keyshortcuts="${key}"` : ""}>
          ${key ? `<kbd aria-hidden="true">${key}</kbd>` : ""}
          <span class="answer-label" aria-hidden="true">${esc(c.label)}</span>
          <span class="answer-spoken" aria-hidden="true">${esc(c.spoken)}</span>
        </button>`;
      })
      .join("");

    this.drawStage();
    this.drawMain();
    this.$(".main-btn").focus();
    if (this.hooks.settings().autoplay) this.autoplayId = window.setTimeout(() => void this.play(), 450);
  }

  private drawStage(note = ""): void {
    const q = this.q();
    const left = this.replaysLeft();
    const replayText = !this.heard
      ? "Tap play to hear it"
      : Number.isFinite(left)
        ? left > 0
          ? `Replays left: ${left}`
          : "No replays left"
        : "Replay as often as you like";
    this.$(".stage").innerHTML = `
      <p class="prompt">${esc(q.prompt)}</p>
      ${q.tag ? `<p class="tag">${esc(q.tag)}</p>` : ""}
      <div class="speaker${this.playing ? " is-playing" : ""}" aria-hidden="true">${sprite("speaker", 6)}</div>
      <p class="stage-note">${esc(note || replayText)}</p>
      ${this.rules.timeLimit !== null && this.timerSeconds() > 0 ? `<div class="timer" hidden><div class="timer-bar"><i></i></div><span class="timer-text"></span></div>` : ""}`;
  }

  private drawMain(): void {
    const btn = this.$(".main-btn") as HTMLButtonElement;
    const n = this.round.index + 1;
    if (this.phase === "feedback") {
      const last = this.round.done;
      btn.innerHTML = `${last ? "See results" : "Next"} ${sprite("next", 3)}`;
      btn.setAttribute("aria-label", last ? "See results" : "Next question");
      btn.disabled = false;
      return;
    }
    const left = this.replaysLeft();
    if (!this.heard) {
      btn.innerHTML = `${sprite("play", 3)} Play`;
      btn.setAttribute("aria-label", `Play question ${n}`);
    } else {
      btn.innerHTML = `${sprite("replay", 3)} Replay${Number.isFinite(left) ? ` (${left})` : ""}`;
      btn.setAttribute("aria-label", Number.isFinite(left) ? `Replay, ${left} left` : "Replay");
    }
    btn.disabled = this.playing || (this.heard && left <= 0);
  }

  // ---------------------------------------------------------------- playing

  private replaysLeft(): number {
    return this.rules.replays - this.replaysUsed;
  }

  private timerSeconds(): number {
    if (this.rules.timeLimit === null) return 0;
    return this.rules.timeLimit * TIMER_MULT[this.hooks.settings().timer];
  }

  private async play(): Promise<void> {
    if (this.autoplayId !== null) {
      window.clearTimeout(this.autoplayId);
      this.autoplayId = null;
    }
    if (this.phase !== "ready" || this.playing) return;
    if (this.heard) {
      if (this.replaysLeft() <= 0) return;
      this.replaysUsed++;
    }
    const first = !this.heard;
    const q = this.q();
    this.playing = true;
    try {
      // Answers unlock only once the sound can really play, so nobody answers during "Loading".
      if (!instrument.isLoaded()) {
        this.drawStage(`Loading ${this.hooks.settings().instrument}...`);
        this.drawMain();
        await instrument.ensureReady();
        if (this.q() !== q || this.phase !== "ready") return;
      }
      this.heard = true;
      const answers = this.$(".answers");
      answers.classList.remove("is-waiting");
      answers.querySelectorAll(".answer").forEach((b) => b.removeAttribute("aria-disabled"));
      this.drawStage();
      this.drawMain();
      await instrument.play(q.sound);
    } catch {
      this.playing = false;
      this.drawStage("Sound could not load. Check your connection and try again.");
      this.hooks.announce("Sound could not load.");
      if (first) this.heard = false;
      else this.replaysUsed--;
      this.drawMain();
      return;
    }
    if (this.q() !== q || this.phase !== "ready") return;
    this.playing = false;
    this.drawStage();
    this.drawMain();
    if (first) this.startTimer();
    // Keep keyboard focus useful: if the main button just got disabled, move to the first answer.
    if (document.activeElement === document.body || (document.activeElement as HTMLButtonElement | null)?.disabled) {
      this.el.querySelector<HTMLElement>(".answer")?.focus();
    }
  }

  private startTimer(): void {
    const secs = this.timerSeconds();
    if (secs <= 0) return;
    const deadline = performance.now() + secs * 1000;
    let lastWhole = Math.ceil(secs);
    let warned = false;
    const tick = () => {
      const left = Math.max(0, (deadline - performance.now()) / 1000);
      const t = this.el.querySelector<HTMLElement>(".timer");
      if (t) {
        t.hidden = false;
        t.classList.toggle("is-low", left <= 3);
        t.querySelector<HTMLElement>(".timer-bar i")!.style.transform = `scaleX(${(left / secs).toFixed(3)})`;
        t.querySelector<HTMLElement>(".timer-text")!.textContent = `${Math.ceil(left)}s`;
      }
      const whole = Math.ceil(left);
      if (whole !== lastWhole) {
        lastWhole = whole;
        if (whole <= 3 && whole > 0) sfx.tick();
      }
      if (!warned && left <= 3) {
        warned = true;
        this.hooks.announce("3 seconds left");
      }
      if (left <= 0) this.answer(null);
    };
    tick();
    this.timerId = window.setInterval(tick, 100);
  }

  private stopTimer(): void {
    if (this.timerId !== null) window.clearInterval(this.timerId);
    this.timerId = null;
  }

  // ---------------------------------------------------------------- answering

  private answer(choiceId: string | null): void {
    if (this.phase !== "ready" || !this.heard) return;
    this.stopTimer();
    instrument.stop();
    this.playing = false;
    const q = this.q();
    const index = this.round.index;
    const a = this.round.answer(choiceId);
    this.chosen = choiceId;
    this.phase = "feedback";
    this.hooks.onAnswer(q, a.correct);

    const answers = this.$(".answers");
    answers.classList.add("is-done");
    answers.querySelectorAll<HTMLElement>(".answer").forEach((b) => {
      b.setAttribute("aria-disabled", "true");
      const id = b.dataset.choice;
      if (id === q.answer) {
        b.classList.add("is-right");
        b.insertAdjacentHTML("beforeend", `<span class="answer-mark" aria-hidden="true">${sprite("check", 2)}</span>`);
        b.setAttribute("aria-label", `${b.getAttribute("aria-label")}, right answer`);
      } else if (id === choiceId) {
        b.classList.add("is-wrong");
        b.insertAdjacentHTML("beforeend", `<span class="answer-mark" aria-hidden="true">${sprite("cross", 2)}</span>`);
        b.setAttribute("aria-label", `${b.getAttribute("aria-label")}, your answer, wrong`);
      }
    });
    const pip = this.el.querySelectorAll(".pip")[index] as HTMLElement;
    pip.classList.remove("is-now");
    pip.classList.add(a.correct ? "is-right" : "is-wrong");
    pip.innerHTML = sprite(a.correct ? "check" : "cross", 2);

    const right = q.choices.find((c) => c.id === q.answer)!;
    const picked = choiceId ? q.choices.find((c) => c.id === choiceId) : null;
    const verdict = a.correct ? "Correct" : choiceId === null ? "Time's up" : "Not quite";
    this.$(".stage").innerHTML = `
      <div class="verdict ${a.correct ? "is-right" : "is-wrong"}">${sprite(a.correct ? "check" : "cross", 4)}<span>${verdict}</span></div>
      <p class="verdict-answer">${a.correct ? "" : "Answer: "}${esc(cap(right.spoken))} (${esc(right.label)})</p>
      <p class="verdict-explain">${esc(q.explain)}${picked && !a.correct ? `<br>You picked ${esc(picked.spoken)}` : ""}</p>
      <div class="row">
        <button class="btn btn--small" type="button" data-act="again">${sprite("replay", 2)} Hear it again</button>
        ${picked && !a.correct && q.compare ? `<button class="btn btn--small" type="button" data-act="yours">${sprite("play", 2)} Hear yours</button>` : ""}
      </div>`;
    this.drawMain();

    const said = a.correct
      ? `Correct, ${right.spoken}. ${q.explain}.`
      : `${verdict}. It was ${right.spoken}. ${q.explain}.${picked ? ` You picked ${picked.spoken}.` : ""}`;
    this.hooks.announce(said);
    if (a.correct) sfx.correct();
    else sfx.wrong();
    // Wrong answers replay the right one, so the ear hears it again.
    if (!a.correct && this.hooks.settings().autoplay) {
      window.setTimeout(() => {
        if (this.phase === "feedback" && this.q() === q) void this.playClip(q.reveal);
      }, 650);
    }
  }

  private async playClip(steps: AudioStep[]): Promise<void> {
    try {
      await instrument.play(steps);
    } catch {
      this.hooks.announce("Sound could not load.");
    }
  }

  private next(): void {
    if (this.phase !== "feedback") return;
    instrument.stop();
    if (this.round.done) this.hooks.onDone(this.round);
    else this.showQuestion();
  }

  // ---------------------------------------------------------------- input

  private click(e: MouseEvent): void {
    const t = (e.target as HTMLElement).closest<HTMLElement>("button");
    if (!t) return;
    const act = t.dataset.act;
    if (t.dataset.choice !== undefined) {
      if (this.phase === "ready" && t.getAttribute("aria-disabled") !== "true") this.answer(t.dataset.choice);
      return;
    }
    switch (act) {
      case "quit":
        this.hooks.onQuit();
        break;
      case "main":
        if (this.phase === "feedback") this.next();
        else void this.play();
        break;
      case "again":
        void this.playClip(this.q().reveal);
        break;
      case "yours":
        if (this.chosen && this.q().compare) void this.playClip(this.q().compare!(this.chosen));
        break;
    }
  }

  private key(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector("dialog[open]")) return;
    const target = e.target as HTMLElement;
    const onOtherButton = target.closest("button") && !target.closest(".answer");
    if (e.key === "Enter" && this.phase === "feedback" && !onOtherButton) {
      e.preventDefault();
      this.next();
      return;
    }
    if (this.phase !== "ready") return;
    if (/^[0-9]$/.test(e.key)) {
      const i = e.key === "0" ? 9 : Number(e.key) - 1;
      const choice = this.q().choices[i];
      if (choice && this.heard) {
        e.preventDefault();
        this.answer(choice.id);
      }
      return;
    }
    if (e.key === "r" || e.key === "R" || (e.key === " " && !target.closest("button"))) {
      e.preventDefault();
      void this.play();
    }
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

