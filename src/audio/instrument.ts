// The musical sound: a sampled piano or guitar. Adapted from Sixline's
// GuitarSound (src/audio/guitar.ts) so it can load either instrument.
//
// Nothing loads or plays until a tap calls `ensureReady()`, which is also what
// browsers require before audio can start.

import * as Tone from "tone";
import type { AudioStep } from "../quiz/types";

export type InstrumentId = "piano" | "guitar";

const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

/** Guitar: every note E2 to G5 (Sixline's FluidR3 set). */
function guitarUrls(): Record<number, string> {
  const urls: Record<number, string> = {};
  for (let m = 40; m <= 79; m++) urls[m] = `${FLAT_NAMES[m % 12]}${Math.floor(m / 12) - 1}.mp3`;
  return urls;
}

/** Piano: Salamander, one sample every minor third, A1 to D#6. */
function pianoUrls(): Record<number, string> {
  const urls: Record<number, string> = {};
  const names: Record<number, string> = { 9: "A", 0: "C", 3: "Ds", 6: "Fs" };
  for (let m = 33; m <= 87; m += 3) urls[m] = `${names[m % 12]}${Math.floor(m / 12) - 1}.mp3`;
  return urls;
}

const SETUP: Record<InstrumentId, { urls: () => Record<number, string>; folder: string; volume: number; release: number; spread: number }> = {
  piano: { urls: pianoUrls, folder: "piano", volume: -2, release: 1, spread: 0 },
  // Chords on guitar are strummed a little, low to high, like Sixline.
  guitar: { urls: guitarUrls, folder: "guitar", volume: -4, release: 1.2, spread: 0.03 },
};

type LoadState = "loading" | "ready" | "error";

class Instrument {
  private samplers = new Map<InstrumentId, Tone.Sampler>();
  private loading = new Map<InstrumentId, Promise<Tone.Sampler>>();
  private reverb: Tone.Reverb | null = null;
  private current: InstrumentId = "piano";
  private endCurrent: (() => void) | null = null;
  private timer: number | null = null;
  private listeners = new Set<(state: LoadState) => void>();
  private volume = 0.8;

  onState(fn: (state: LoadState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setInstrument(id: InstrumentId): void {
    this.current = id;
  }

  /** 0 to 1. */
  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.reverb) this.applyVolume();
  }

  private applyVolume(): void {
    const dest = Tone.getDestination();
    dest.mute = this.volume === 0;
    if (this.volume > 0) dest.volume.value = Tone.gainToDb(this.volume);
  }

  /** Must be called from a tap, click or key press. Loads the chosen instrument. */
  async ensureReady(): Promise<Tone.Sampler> {
    // iPhones mute web audio when the ring switch is on silent, unless the page says it plays media.
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = "playback";
    await Tone.start();
    if (!this.reverb) {
      this.reverb = new Tone.Reverb({ decay: 1.6, wet: 0.12 }).toDestination();
      this.applyVolume();
    }
    const id = this.current;
    const have = this.loading.get(id);
    if (have) return have;
    this.emit("loading");
    const setup = SETUP[id];
    const p = new Promise<Tone.Sampler>((resolve, reject) => {
      const s = new Tone.Sampler({
        urls: setup.urls(),
        baseUrl: `${import.meta.env.BASE_URL}samples/${setup.folder}/`,
        release: setup.release,
        onload: () => {
          this.samplers.set(id, s);
          this.emit("ready");
          resolve(s);
        },
        onerror: (err) => {
          this.loading.delete(id);
          this.emit("error");
          reject(err);
        },
      }).connect(this.reverb!);
      s.volume.value = setup.volume;
    });
    this.loading.set(id, p);
    return p;
  }

  /**
   * Plays a clip of steps and resolves when it has finished sounding (or is
   * stopped). Each step's notes start together, or strummed on guitar.
   */
  async play(steps: readonly AudioStep[]): Promise<void> {
    const sampler = await this.ensureReady();
    this.stop();
    const spread = SETUP[this.current].spread;
    // Scheduled on the transport (as in Sixline) so stop() can cancel notes that have not started yet.
    const transport = Tone.getTransport();
    for (const step of steps) {
      transport.scheduleOnce((time) => {
        step.midis.forEach((midi, k) => {
          sampler.triggerAttackRelease(Tone.Frequency(midi, "midi").toFrequency(), step.dur, time + k * spread);
        });
      }, step.at);
    }
    transport.position = 0;
    transport.start("+0.05");
    const length = Math.max(0, ...steps.map((s) => s.at + s.dur));
    return new Promise<void>((resolve) => {
      let ended = false;
      const end = () => {
        if (ended) return;
        ended = true;
        if (this.endCurrent === end) this.endCurrent = null;
        if (this.timer !== null) window.clearTimeout(this.timer);
        this.timer = null;
        resolve();
      };
      this.endCurrent = end;
      // Counted as "done" a little before the last note fades, so answering feels quick.
      this.timer = window.setTimeout(end, (length * 0.85 + 0.05) * 1000);
    });
  }

  /** Cuts off whatever is playing. */
  stop(): void {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
    for (const s of this.samplers.values()) s.releaseAll();
    const end = this.endCurrent;
    this.endCurrent = null;
    end?.();
  }

  /** Whether the chosen instrument's samples are loaded. */
  isLoaded(): boolean {
    return this.samplers.has(this.current);
  }

  get isPlaying(): boolean {
    return this.endCurrent !== null;
  }

  private emit(state: LoadState) {
    for (const fn of this.listeners) fn(state);
  }
}

/** One shared instrument for the whole app. */
export const instrument = new Instrument();
