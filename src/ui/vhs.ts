// The VHS backdrop: a dark tape-noise picture with faint streaks of color
// noise and the ragged head-switching band at the bottom, drawn once (per
// screen size) into a low-resolution canvas and scaled up with crisp pixels.
// On top sit scanlines and a slow tracking band (CSS, so reduced motion can
// stop it), and a VCR-style on-screen display: PLAY, PAUSE, STOP, REW and a
// tape counter. All of it is decoration, hidden from screen readers.

import { Rng } from "../quiz/rng";
import { pixelSVG } from "./pixels";

const PX = 3; // screen pixels per art pixel

// 4 x 4 ordered dither: smooth gradients from a few flat colors.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const dither = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)]!;

type RGB = [number, number, number];
function hex(c: string): RGB {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

const SCREEN = ["#050409", "#09070f", "#0d0a16"].map(hex);
const STREAK = ["#15121f", "#1c1829", "#262136"].map(hex);
const CHROMA = ["#3a1233", "#0e3440", "#3a3410"].map(hex); // magenta, cyan, yellow, all dim
const HEAD = ["#2a2636", "#6b6580", "#c9c3dd"].map(hex);

function paintTape(canvas: HTMLCanvasElement): void {
  const w = Math.ceil(window.innerWidth / PX);
  const h = Math.ceil(window.innerHeight / PX);
  if (w <= 0 || h <= 0) return;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const put = (x: number, y: number, c: RGB) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
    d[i + 3] = 255;
  };
  const rng = new Rng(19851117);

  // The screen: brightest in the middle, dithered darker toward the edges (a CRT vignette).
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x / w - 0.5) * 2;
      const dy = (y / h - 0.5) * 2;
      const glow = 1 - Math.min(1, (dx * dx + dy * dy) / 1.6);
      const band = Math.min(SCREEN.length - 1, Math.floor(glow * (SCREEN.length - 1) + dither(x, y)));
      put(x, y, SCREEN[band]!);
    }
  }

  // Tape noise: short horizontal streaks, the way worn tape drops out.
  const streaks = Math.floor((w * h) / 160);
  for (let i = 0; i < streaks; i++) {
    const y = rng.int(h);
    const x = rng.int(w);
    const len = 2 + rng.int(rng.next() < 0.15 ? 40 : 10);
    const c = STREAK[rng.int(STREAK.length)]!;
    for (let k = 0; k < len; k++) put(x + k, y, c);
  }

  // Color noise: rarer, dimmer streaks of magenta, cyan and yellow.
  const chroma = Math.floor((w * h) / 900);
  for (let i = 0; i < chroma; i++) {
    const y = rng.int(h);
    const x = rng.int(w);
    const len = 3 + rng.int(16);
    const c = CHROMA[rng.int(CHROMA.length)]!;
    for (let k = 0; k < len; k++) put(x + k, y, c);
  }

  // Head-switching noise: a ragged, shifted band along the bottom edge.
  const rows = Math.max(4, Math.round(h * 0.012));
  for (let r = 0; r < rows; r++) {
    const y = h - rows + r;
    const shift = rng.int(6);
    for (let x = 0; x < w; x++) {
      const v = rng.next();
      if (v < 0.35) continue;
      put(x + shift, y, HEAD[v > 0.93 ? 2 : v > 0.7 ? 1 : 0]!);
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** A small strip of static for the tracking band, as a data URL (or "" where canvas is missing). */
function staticStrip(): string {
  try {
    const c = document.createElement("canvas");
    c.width = 96;
    c.height = 10;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    const rng = new Rng(7);
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; ) {
        const len = 1 + rng.int(9);
        const v = rng.next();
        if (v > 0.55) {
          const g = Math.round(120 + v * 135);
          ctx.fillStyle = `rgb(${g},${g},${Math.min(255, g + 20)})`;
          ctx.fillRect(x, y, len, 1);
        }
        x += len;
      }
    }
    return c.toDataURL();
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------- on-screen display

export type TapeState = "menu" | "play" | "pause" | "stop" | "rew";

const OSD_ART: Record<Exclude<TapeState, "menu">, string[]> = {
  play: ["#....", "###..", "#####", "###..", "#...."],
  pause: ["##.##", "##.##", "##.##", "##.##", "##.##"],
  stop: ["#####", "#####", "#####", "#####", "#####"],
  rew: ["..#..#", ".##.##", "######", ".##.##", "..#..#"],
};
const OSD_WORD: Record<TapeState, string> = { menu: "Menu", play: "Play", pause: "Pause", stop: "Stop", rew: "Rew" };

export class Vhs {
  private osdState: HTMLElement;
  private counter: HTMLElement;
  private seconds = 0;
  private running = false;

  constructor(osd: HTMLElement) {
    const canvas = document.createElement("canvas");
    canvas.className = "tape";
    const lines = document.createElement("div");
    lines.className = "scanlines";
    const band = document.createElement("div");
    band.className = "tracking";
    const strip = staticStrip();
    if (strip) band.style.setProperty("--static", `url(${strip})`);
    for (const el of [canvas, lines, band]) el.setAttribute("aria-hidden", "true");
    document.body.prepend(canvas, lines, band);

    let last = "";
    const draw = () => {
      const key = `${Math.ceil(window.innerWidth / PX)}x${Math.ceil(window.innerHeight / PX)}`;
      if (key === last) return;
      last = key;
      paintTape(canvas);
    };
    draw();
    window.addEventListener("resize", draw);

    osd.setAttribute("aria-hidden", "true");
    osd.innerHTML = `<span class="osd-state"></span><span class="osd-counter"></span>`;
    this.osdState = osd.querySelector(".osd-state")!;
    this.counter = osd.querySelector(".osd-counter")!;
    this.drawCounter();
    // The tape counter runs while a round is on screen, like a VCR's.
    window.setInterval(() => {
      if (!this.running || document.hidden) return;
      this.seconds++;
      this.drawCounter();
    }, 1000);
  }

  /** Sets the on-screen display. The counter runs during play and pause. */
  tape(state: TapeState): void {
    if (this.osdState.dataset.state === state) return;
    this.osdState.dataset.state = state;
    const icon = state === "menu" ? "" : pixelSVG(OSD_ART[state], { "#": "currentColor" }, 3, "osd-icon");
    this.osdState.innerHTML = `${state === "rew" ? icon : ""}<span>${OSD_WORD[state]}</span>${state !== "rew" ? icon : ""}`;
    this.running = state === "play" || state === "pause";
  }

  private drawCounter(): void {
    const s = this.seconds;
    const p = (n: number) => String(n).padStart(2, "0");
    this.counter.textContent = `SP ${Math.floor(s / 3600)}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
  }
}
