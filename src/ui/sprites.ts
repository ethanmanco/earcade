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
  flame: ["...#...", "..##...", "..###.#", ".#####.", ".######", "#######", "###.###", "##...##", ".#####."],
  chart: [".......##", ".......##", "....##.##", "....##.##", ".##.##.##", ".##.##.##", ".##.##.##", "#########"],
  lock: ["..###..", ".#...#.", ".#...#.", "#######", "###.###", "###.###", "#######"],
};

export type SpriteName = keyof typeof ART;

/** An icon at `scale` screen pixels per art pixel. */
export function sprite(name: SpriteName, scale = 3, className = "icon"): string {
  return pixelSVG(ART[name], MONO, scale, className);
}

/** The Earcade logo: a pixel VHS tape with a striped label. */
export const LOGO_ROWS = [
  "hhhhhhhhhhhhhhhh",
  "hllllllllllllllk",
  "hlmmmmyyyycccclk",
  "hllllllllllllllk",
  "hkkkkkkkkkkkkkkk",
  "hkddddddddddddkk",
  "hkdrrrddddrrrdkk",
  "hkdrwrddddrwrdkk",
  "hkdrrrddddrrrdkk",
  "hkddddddddddddkk",
  "kkkkkkkkkkkkkkkk",
];
export const LOGO_PALETTE: Palette = {
  h: "#5a5373",
  k: "#2e2940",
  l: "#f2f0ff",
  m: "#ff3c9e",
  y: "#ffe45c",
  c: "#2ef2ff",
  d: "#07060c",
  r: "#6b6580",
  w: "#f2f0ff",
};

export function logo(scale = 3): string {
  return pixelSVG(LOGO_ROWS, LOGO_PALETTE, scale, "logo");
}
