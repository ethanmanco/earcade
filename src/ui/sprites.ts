// Pixel icons, drawn as text grids (see pixels.ts). "#" uses the text color,
// so an icon takes the color of the button it sits in.

import { pixelSVG, type Palette } from "./pixels";

const MONO: Palette = { "#": "currentColor" };

const ART = {
  check: ["......##", ".....##.", "##..##..", ".####...", "..##...."],
  cross: ["##...##", ".##.##.", "..###..", ".##.##.", "##...##"],
  play: ["#......", "###....", "#####..", "#######", "#####..", "###....", "#......"],
  replay: ["..####..", ".#....#.", "#......#", "#......#", "#....###", ".#....#.", "..##...#"],
  next: ["#......", "###....", "#####..", "#######", "#####..", "###....", "#......"],
  back: ["...#....", "..##....", ".#######", "########", ".#######", "..##....", "...#...."],
  close: ["##...##", "###.###", ".#####.", "..###..", ".#####.", "###.###", "##...##"],
  gear: ["....#....", ".#.###.#.", "..#####..", ".##...##.", "###...###", ".##...##.", "..#####..", ".#.###.#.", "....#...."],
  star: ["....#....", "...###...", "#########", ".#######.", "..#####..", ".###.###.", ".#.....#."],
  speaker: ["....#..#..", "...##...#.", "####.#..#.", "####..#.#.", "####..#.#.", "####.#..#.", "...##...#.", "....#..#.."],
  note: ["....##..", "....###.", "....#.##", "....#..#", "....#...", ".####...", "#####...", ".###...."],
  chord: ["..###..", ".#####.", "..###..", ".......", "..###..", ".#####.", "..###..", ".......", "..###..", ".#####.", "..###.."],
  stairs: ["......###", "......###", "...######", "...######", "#########", "#########"],
  frets: ["#.#.#.#", "#######", "#.#.#.#", "#.###.#", "#######", "#.###.#", "#######", "#.#.#.#"],
  lock: ["..###..", ".#...#.", ".#...#.", "#######", "###.###", "###.###", "#######"],
};

export type SpriteName = keyof typeof ART;

/** An icon at `scale` screen pixels per art pixel. */
export function sprite(name: SpriteName, scale = 3, className = "icon"): string {
  return pixelSVG(ART[name], MONO, scale, className);
}

/** The Earcade logo: a pair of pixel headphones. */
export const LOGO_ROWS = [
  "...kkkkkk...",
  "..kaaaaaak..",
  ".ka.kkkk.ak.",
  ".kak....kak.",
  "kak......kak",
  "kak......kak",
  "kkkk....kkkk",
  "kggk....kggk",
  "kgyk....kgyk",
  "kggk....kggk",
  "kkkk....kkkk",
];
export const LOGO_PALETTE: Palette = { k: "#0a0b22", a: "#36e2ff", g: "#ffd166", y: "#fff3c4" };

export function logo(scale = 3): string {
  return pixelSVG(LOGO_ROWS, LOGO_PALETTE, scale, "logo");
}
