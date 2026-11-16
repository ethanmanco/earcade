// Screens and navigation: home, level picker, round, results and settings.

import { instrument } from "../audio/instrument";
import { setGameSounds, sfx, unlockSfx } from "../audio/sfx";
import { recordResult } from "../quiz/adaptive";
import { MODES, modeInfo, modeRules } from "../quiz/modes";
import { Rng, randomSeed } from "../quiz/rng";
import { Round } from "../quiz/round";
import { LEVEL_IDS, LEVEL_NAMES, type LevelId, type ModeId } from "../quiz/types";
import {
  MAX_ROUNDS,
  historyFor,
  historyKey,
  load,
  save,
  suggestNext,
  type RoundRecord,
  type Saved,
  type Settings,
} from "../progress/storage";
import { esc, frac } from "./html";
import { prettyNotes } from "./notes";
import { RoundView } from "./roundView";
import { progressPanel, statsPage } from "./stats";
import { bumpStreak, dayKey, emptyStreak, playerLevel, xpForRound } from "../progress/progress";
import { paintSpace } from "./space";
import { logo, sprite, type SpriteName } from "./sprites";

const MODE_ICON: Record<ModeId, SpriteName> = { intervals: "note", chords: "chord", degrees: "stairs", fretboard: "frets" };

/** `?seed=123` in the URL (dev only) makes rounds repeatable, for demos and checks. */
function devSeed(): number | null {
  if (!import.meta.env.DEV) return null;
  const v = new URLSearchParams(location.search).get("seed");
  return v !== null && /^\d+$/.test(v) ? Number(v) : null;
}

export class App {
  private saved: Saved;
  private view: HTMLElement;
  private live: HTMLElement;
  private roundView: RoundView | null = null;
  private seed = devSeed();
  private motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  constructor(root: HTMLElement) {
    this.saved = load();
    root.innerHTML = `<div class="screen" id="view"></div><p class="sr-only" role="status" aria-live="polite"></p>`;
    this.view = root.querySelector("#view")!;
    this.live = root.querySelector('[role="status"]')!;

    const canvas = document.createElement("canvas");
    canvas.className = "space";
    canvas.setAttribute("aria-hidden", "true");
    const twinkles = document.createElement("div");
    twinkles.className = "twinkles";
    twinkles.setAttribute("aria-hidden", "true");
    document.body.prepend(canvas, twinkles);
    paintSpace(canvas, twinkles);

    for (const type of ["pointerdown", "keydown"] as const) document.addEventListener(type, unlockSfx);
    this.motionQuery.addEventListener("change", () => this.applySettings());
    window.addEventListener("hashchange", () => this.route());
    this.applySettings();
  }

  start(): void {
    this.route();
  }

  // ---------------------------------------------------------------- helpers

  private get settings(): Settings {
    return this.saved.settings;
  }

  private persist(): void {
    save(this.saved);
  }

  private applySettings(): void {
    const s = this.settings;
    instrument.setInstrument(s.instrument);
    instrument.setVolume(s.volume);
    setGameSounds(s.gameSounds, s.volume);
    const reduce = s.motion === "reduce" || (s.motion === "system" && this.motionQuery.matches);
    document.documentElement.dataset.motion = reduce ? "reduce" : "full";
  }

  /** Says something to screen readers. Re-set so the same text is announced again. */
  announce(text: string): void {
    this.live.textContent = "";
    window.setTimeout(() => (this.live.textContent = text), 60);
  }

  private show(html: string, focus = "h1"): void {
    this.roundView?.destroy();
    this.roundView = null;
    this.view.innerHTML = html;
    window.scrollTo(0, 0);
    this.view.querySelector<HTMLElement>(focus)?.focus();
  }

  private go(hash: string): void {
    if (location.hash === hash || (hash === "" && location.hash === "")) this.route();
    else location.hash = hash;
  }

  private route(): void {
    const [mode, sub] = location.hash.replace(/^#/, "").split("/");
    if (mode === "stats") return this.showStats();
    const info = MODES.find((m) => m.id === mode);
    if (!info || !info.ready) return this.showHome();
    if (sub === "round" && this.roundView) return;
    if (sub === "round") {
      history.replaceState(null, "", `#${info.id}`);
    }
    this.showLevels(info.id);
  }

  private suggestionFor(mode: ModeId): LevelId | null {
    const last = this.saved.lastLevel[mode];
    return last ? suggestNext(this.saved.rounds, mode, last) : null;
  }

  // ---------------------------------------------------------------- home

  private showHome(): void {
    const tiles = MODES.map((m) => {
      const last = this.saved.lastLevel[m.id];
      const suggestion = this.suggestionFor(m.id);
      const meta = !m.ready
        ? `<span>Coming soon</span>`
        : `${last ? `<span>Level: ${LEVEL_NAMES[last]}</span>` : `<span>Start here</span>`}${
            suggestion ? `<span class="badge">${sprite("star", 1)} Try ${LEVEL_NAMES[suggestion]}</span>` : ""
          }`;
      return `<li><button class="tile" type="button" data-mode="${m.id}"${m.ready ? "" : " disabled"}
          aria-labelledby="tile-${m.id}" aria-describedby="tile-${m.id}-blurb tile-${m.id}-meta">
        <span class="tile-icon" aria-hidden="true">${sprite(m.ready ? MODE_ICON[m.id] : "lock", 4)}</span>
        <span class="tile-name" id="tile-${m.id}">${esc(m.name)}</span>
        <span class="tile-blurb" id="tile-${m.id}-blurb">${esc(m.blurb)}</span>
        <span class="tile-meta" id="tile-${m.id}-meta">${meta}</span>
      </button></li>`;
    }).join("");

    this.show(`
      <header class="topbar">
        <h1 class="title" tabindex="-1">${logo(3)}<span>Earcade</span></h1>
        <div class="topbar-end">
          <button class="icon-btn" type="button" data-act="stats" aria-label="Stats">${sprite("chart", 3)}</button>
          <button class="icon-btn" type="button" data-act="settings" aria-label="Settings">${sprite("gear", 3)}</button>
        </div>
      </header>
      ${progressPanel(this.saved, dayKey(new Date()))}
      <p class="tagline">Train your ear in quick rounds of 10. Pick a mode to start.</p>
      <h2 class="sr-only">Modes</h2>
      <ul class="tiles">${tiles}</ul>`);

    this.view.querySelectorAll<HTMLButtonElement>(".tile").forEach((b) =>
      b.addEventListener("click", () => this.go(`#${b.dataset.mode}`)),
    );
    this.view.querySelector('[data-act="settings"]')!.addEventListener("click", () => this.openSettings());
    this.view.querySelector('[data-act="stats"]')!.addEventListener("click", () => this.go("#stats"));
  }

  // ---------------------------------------------------------------- stats

  private showStats(): void {
    this.show(statsPage(this.saved, dayKey(new Date())));
    this.view.querySelector('[data-act="home"]')!.addEventListener("click", () => this.go(""));
    const reset = this.view.querySelector<HTMLButtonElement>('[data-act="reset"]')!;
    const note = this.view.querySelector<HTMLElement>("#reset-note")!;
    let armed: number | null = null;
    // Two taps, so progress is never erased by accident.
    reset.addEventListener("click", () => {
      if (armed === null) {
        reset.textContent = "Tap again to erase";
        note.textContent = "Tap Reset progress again within 5 seconds to erase your progress.";
        armed = window.setTimeout(() => {
          armed = null;
          reset.textContent = "Reset progress";
          note.textContent = "";
        }, 5000);
        return;
      }
      window.clearTimeout(armed);
      this.saved = { ...this.saved, history: {}, rounds: [], lastLevel: {}, xp: 0, streak: emptyStreak() };
      this.persist();
      this.showStats();
      this.announce("Progress erased.");
    });
  }

  // ---------------------------------------------------------------- level picker

  private showLevels(mode: ModeId): void {
    const info = modeInfo(mode);
    const suggestion = this.suggestionFor(mode);
    const levels = LEVEL_IDS.map((level) => {
      const rules = modeRules(mode, level);
      const mine = this.saved.rounds.filter((r) => r.mode === mode && r.level === level);
      const best = mine.reduce<RoundRecord | null>((b, r) => (!b || r.score / r.total > b.score / b.total ? r : b), null);
      const meta = [
        best ? `<span>Best ${frac(best.score, best.total)}</span><span>Played ${mine.length}</span>` : `<span>Not played yet</span>`,
        level === suggestion ? `<span class="badge">${sprite("star", 1)} Suggested next</span>` : "",
      ].join("");
      return `<li><button class="level${level === suggestion ? " is-suggested" : ""}" type="button" data-level="${level}"
          aria-labelledby="lvl-${level}" aria-describedby="lvl-${level}-sum lvl-${level}-meta">
        <span class="level-name" id="lvl-${level}">${LEVEL_NAMES[level]}</span>
        <span class="level-summary" id="lvl-${level}-sum">${esc(rules.summary)}</span>
        <span class="level-meta" id="lvl-${level}-meta">${meta}</span>
      </button></li>`;
    }).join("");

    this.show(`
      <header class="topbar">
        <button class="icon-btn" type="button" data-act="home" aria-label="Back to modes">${sprite("back", 3)}</button>
        <h1 class="title" tabindex="-1">${esc(info.name)}</h1>
        <div class="topbar-end">
          <button class="icon-btn" type="button" data-act="settings" aria-label="Settings">${sprite("gear", 3)}</button>
        </div>
      </header>
      <p class="tagline">${esc(info.blurb)} Pick any level.</p>
      <h2 class="sr-only">Levels</h2>
      <ul class="levels">${levels}</ul>`);

    this.view.querySelectorAll<HTMLButtonElement>(".level").forEach((b) =>
      b.addEventListener("click", () => this.startRound(mode, b.dataset.level as LevelId)),
    );
    this.view.querySelector('[data-act="home"]')!.addEventListener("click", () => this.go(""));
    this.view.querySelector('[data-act="settings"]')!.addEventListener("click", () => this.openSettings());
  }

  // ---------------------------------------------------------------- round

  private startRound(mode: ModeId, level: LevelId): void {
    // Load the sound during this tap, so it is ready by the time the first question plays.
    void instrument.ensureReady().catch(() => undefined);
    const rng = new Rng(this.seed ?? randomSeed());
    const round = new Round(mode, level, historyFor(this.saved, mode, level), rng);
    // Dev only: lets scripts/record-demo.mjs see the round, to pick right and wrong answers on purpose.
    if (import.meta.env.DEV) (window as unknown as { __round?: Round }).__round = round;
    this.saved.lastLevel[mode] = level;
    this.persist();
    history.pushState(null, "", `#${mode}/round`);

    this.roundView?.destroy();
    const view = new RoundView(round, {
      settings: () => this.settings,
      announce: (t) => this.announce(t),
      onAnswer: (q, answer) => {
        for (const part of answer.parts) recordResult(this.saved.history, historyKey(q.mode, q.level, part.itemId), part.correct);
        this.persist();
      },
      onQuit: () => {
        this.go(`#${mode}`);
      },
      onDone: (r) => this.finishRound(r),
    });
    this.view.replaceChildren(view.el);
    this.roundView = view;
    window.scrollTo(0, 0);
    view.start();
  }

  private finishRound(round: Round): void {
    const s = round.summary();
    const rules = modeRules(s.mode, s.level);
    const items: Record<string, [number, number]> = {};
    for (const it of s.items) items[it.itemId] = [it.right, it.total];
    const rec: RoundRecord = { at: Date.now(), mode: s.mode, level: s.level, score: s.score, total: s.total, items };
    if (rules.timeLimit !== null && this.settings.timer !== "normal") rec.timer = this.settings.timer;
    this.saved.rounds.push(rec);
    if (this.saved.rounds.length > MAX_ROUNDS) this.saved.rounds.splice(0, this.saved.rounds.length - MAX_ROUNDS);
    const gained = xpForRound(rec);
    const levelBefore = playerLevel(this.saved.xp).level;
    this.saved.xp += gained;
    const levelAfter = playerLevel(this.saved.xp).level;
    const streakBefore = this.saved.streak.current;
    this.saved.streak = bumpStreak(this.saved.streak, dayKey(new Date()));
    const streak = this.saved.streak;
    const streakGrew = streak.current > streakBefore || streak.current === 1;
    this.persist();
    history.replaceState(null, "", `#${s.mode}`);
    sfx.fanfare();

    const pct = Math.round((s.score / s.total) * 100);
    const cheer =
      s.score === s.total ? "Perfect round!" : pct >= 90 ? "Sharp ears!" : pct >= 70 ? "Nice work." : pct >= 50 ? "Getting there." : "Keep at it. Every miss trains your ear.";
    const suggestion = suggestNext(this.saved.rounds, s.mode, s.level);

    const rows = s.items
      .map(
        (it) => `<li class="item-row">
          <span class="item-name">${esc(cap(it.spoken))}${it.label === it.spoken ? "" : ` <span aria-hidden="true">(${prettyNotes(it.label)})</span>`}</span>
          <span class="item-score">${it.right} of ${it.total}</span>
          <span class="item-bar" aria-hidden="true">${Array.from({ length: it.total }, (_, i) => `<i class="${i < it.right ? "is-right" : "is-wrong"}"></i>`).join("")}</span>
        </li>`,
      )
      .join("");
    const practice = s.practice.length
      ? `<p class="practice">${s.practice.map((p) => esc(p.spoken)).join(", ")}</p><p class="menu-note">These come up more often in your next rounds.</p>`
      : `<p class="practice">Nothing to practice. Clean round!</p>`;

    this.show(`
      <header class="topbar">
        <h1 class="title" tabindex="-1">Round complete</h1>
      </header>
      <section class="panel score" aria-label="Score">
        <p class="score-big">${frac(s.score, s.total)}</p>
        <p class="score-line">${pct}% right. ${esc(modeInfo(s.mode).name)}, ${LEVEL_NAMES[s.level]}.</p>
        <p class="score-line">${cheer}</p>
      </section>
      <section class="panel reward" aria-label="XP and streak">
        <p class="reward-xp">+${gained} XP</p>
        ${levelAfter > levelBefore ? `<p class="reward-up">${sprite("star", 3)} Level up! You're level ${levelAfter}.</p>` : `<p class="score-line">Level ${levelAfter}, ${this.saved.xp} XP in all.</p>`}
        <p class="streak is-on">${sprite("flame", 2)}<span>${streak.current} day streak${streakGrew && streak.current > 1 && streak.current === streak.best ? ". New best!" : ""}</span></p>
      </section>
      ${
        suggestion
          ? `<section class="panel suggest" aria-label="Suggestion">
              <p>${sprite("star", 3)} You're ready for ${LEVEL_NAMES[suggestion]}.</p>
              <button class="btn btn--gold" type="button" data-act="level-up">Play ${LEVEL_NAMES[suggestion]}</button>
            </section>`
          : ""
      }
      <section class="panel">
        <h2 class="section-title">Your answers</h2>
        <ul class="item-list">${rows}</ul>
      </section>
      <section class="panel">
        <h2 class="section-title">To practice</h2>
        ${practice}
      </section>
      <div class="row">
        <button class="btn btn--go" type="button" data-act="again">Play again</button>
        <button class="btn" type="button" data-act="levels">Levels</button>
      </div>`);
    this.announce(
      `Round complete. ${s.score} of ${s.total}. ${cheer} Plus ${gained} XP.${levelAfter > levelBefore ? ` Level up, you're level ${levelAfter}.` : ""} ${streak.current} day streak.${suggestion ? ` You're ready for ${LEVEL_NAMES[suggestion]}.` : ""}`,
    );

    this.view.querySelector('[data-act="again"]')!.addEventListener("click", () => this.startRound(s.mode, s.level));
    this.view.querySelector('[data-act="levels"]')!.addEventListener("click", () => this.go(`#${s.mode}`));
    this.view.querySelector('[data-act="level-up"]')?.addEventListener("click", () => this.startRound(s.mode, suggestion!));
  }

  // ---------------------------------------------------------------- settings

  private openSettings(): void {
    const s = this.settings;
    const seg = (name: keyof Settings, label: string, options: [string, string][]) => `
      <div class="menu-section">
        <h3 id="lbl-${name}">${label}</h3>
        <div class="seg" role="radiogroup" aria-labelledby="lbl-${name}" data-setting="${name}">
          ${options
            .map(([v, text]) => {
              const on = String(s[name]) === v;
              return `<button class="btn" type="button" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-value="${v}">${text}</button>`;
            })
            .join("")}
        </div>
      </div>`;

    const dialog = document.createElement("dialog");
    dialog.className = "menu";
    dialog.setAttribute("aria-labelledby", "settings-title");
    dialog.innerHTML = `
      <h2 class="menu-title" id="settings-title">Settings</h2>
      ${seg("instrument", "Sound", [["piano", "Piano"], ["guitar", "Guitar"]])}
      <div class="menu-section">
        <label class="h" for="volume">Volume</label>
        <div class="slider-row">
          <input class="slider" id="volume" type="range" min="0" max="100" step="5" value="${Math.round(s.volume * 100)}">
          <span class="slider-value" aria-hidden="true">${Math.round(s.volume * 100)}%</span>
        </div>
      </div>
      ${seg("motion", "Motion", [["system", "Device"], ["reduce", "Reduced"], ["full", "Full"]])}
      ${seg("autoplay", "Auto-play sounds", [["true", "On"], ["false", "Off"]])}
      <p class="menu-note">Plays each question as it appears, and the right answer after a miss. Screen reader users may prefer Off, so speech and notes don't overlap.</p>
      ${seg("timer", "Master time limit", [["normal", "Normal"], ["double", "Double"], ["off", "Off"]])}
      <p class="menu-note">Untimed Master rounds are marked as untimed.</p>
      ${seg("gameSounds", "Game sounds", [["true", "On"], ["false", "Off"]])}
      <div class="menu-actions"><button class="btn btn--wide" type="button" data-act="close">Done</button></div>`;
    document.body.append(dialog);

    const set = (patch: Partial<Settings>) => {
      this.saved.settings = { ...this.saved.settings, ...patch };
      this.persist();
      this.applySettings();
    };

    const pick = (group: HTMLElement, btn: HTMLElement) => {
      group.querySelectorAll<HTMLElement>('[role="radio"]').forEach((b) => {
        const on = b === btn;
        b.setAttribute("aria-checked", String(on));
        b.tabIndex = on ? 0 : -1;
      });
      const name = group.dataset.setting as keyof Settings;
      const raw = btn.dataset.value!;
      const value = raw === "true" ? true : raw === "false" ? false : raw;
      set({ [name]: value } as Partial<Settings>);
      if (name === "instrument") void instrument.play([{ midis: [60, 64, 67], at: 0, dur: 1.2 }]).catch(() => undefined);
    };

    dialog.querySelectorAll<HTMLElement>('[role="radiogroup"]').forEach((group) => {
      group.addEventListener("click", (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('[role="radio"]');
        if (btn) pick(group, btn);
      });
      // Arrow keys move between options, as in any radio group.
      group.addEventListener("keydown", (e) => {
        const radios = [...group.querySelectorAll<HTMLElement>('[role="radio"]')];
        const i = radios.indexOf(e.target as HTMLElement);
        if (i < 0) return;
        const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const next = radios[(i + step + radios.length) % radios.length]!;
        next.focus();
        pick(group, next);
      });
    });

    const vol = dialog.querySelector<HTMLInputElement>("#volume")!;
    const volText = dialog.querySelector<HTMLElement>(".slider-value")!;
    vol.addEventListener("input", () => {
      volText.textContent = `${vol.value}%`;
      set({ volume: Number(vol.value) / 100 });
    });
    // A short note on release, to hear the new level.
    vol.addEventListener("change", () => void instrument.play([{ midis: [67], at: 0, dur: 0.8 }]).catch(() => undefined));

    const close = () => dialog.close();
    dialog.querySelector('[data-act="close"]')!.addEventListener("click", close);
    dialog.addEventListener("close", () => {
      dialog.remove();
      this.route();
      this.view.querySelector<HTMLElement>('[data-act="settings"]')?.focus();
    });
    dialog.showModal();
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
