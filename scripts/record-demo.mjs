// Records docs/demo.gif: part of a real Intervals round on a phone-sized
// screen, then the results. Adapted from Pocket Pixels' record-demo.mjs.
//
// Needs the dev server running (npm run dev) and Chrome installed.
//   node scripts/record-demo.mjs [dev server url]
// Set CHROME_PATH if Chrome is not in the default Windows location.

import { mkdirSync, writeFileSync } from "node:fs";
import gifenc from "gifenc";
import { PNG } from "pngjs";
import puppeteer from "puppeteer-core";

const { GIFEncoder, applyPalette, quantize } = gifenc;

const BASE = process.argv[2] ?? "http://localhost:5173/";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const VIEWPORT = { width: 375, height: 700, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
await page.setViewport(VIEWPORT);
await page.goto(`${BASE}?seed=21`, { waitUntil: "networkidle0" });
// A fresh player with a 2 day streak, so the results show the streak growing.
await page.evaluate(() => {
  const y = new Date(Date.now() - 86_400_000);
  const p = (n) => String(n).padStart(2, "0");
  const day = `${y.getFullYear()}-${p(y.getMonth() + 1)}-${p(y.getDate())}`;
  localStorage.setItem("earcade:v1", JSON.stringify({ xp: 260, streak: { current: 2, best: 2, lastDay: day } }));
});
// A different query string, so this is a real reload that reads the saved data.
await page.goto(`${BASE}?seed=21&demo=1#intervals`, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);
// Hold the twinkling stars still so the GIF only changes when the game does.
await page.addStyleTag({ content: ".twinkles i { animation: none !important; opacity: 0.5 !important; }" });

let recording = true;
let stop = false;
const frames = [];
const camera = (async () => {
  while (!stop) {
    if (recording) frames.push({ buf: await page.screenshot({ type: "png" }), t: Date.now() });
    await sleep(70);
  }
})();

const tap = (sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel);
const answerable = () => page.waitForFunction(() => !!document.querySelector(".answer:not([aria-disabled])"), { timeout: 15000 });
const pick = (right) =>
  page.evaluate((r) => {
    const q = window.__round.current;
    const id = r ? q.answer : q.choices.find((c) => c.id !== q.answer && Math.abs(q.choices.indexOf(c) - q.choices.findIndex((x) => x.id === q.answer)) === 1).id;
    document.querySelector(`.answer[data-choice="${id}"]`).click();
  }, right);

await sleep(900);
await tap('.level[data-level="intermediate"]');
// Three questions at a normal pace: right, wrong (with Hear yours), right.
for (const [i, right] of [true, false, true].entries()) {
  await answerable();
  await sleep(2300);
  await pick(right);
  await sleep(right ? 1500 : 2400);
  if (!right) {
    await tap('[data-act="yours"]');
    await sleep(1800);
  }
  await tap('[data-act="main"]');
  if (i === 2) break;
}
// Skip ahead through the rest of the round without recording.
recording = false;
for (let i = 3; i < 10; i++) {
  await answerable();
  await pick(i % 4 !== 1);
  await sleep(120);
  await tap('[data-act="main"]');
}
await page.waitForFunction(() => !!document.querySelector(".reward"), { timeout: 15000 });
recording = true;
await sleep(3500);
stop = true;
await camera;
await browser.close();

// Encode: merge repeated frames (the earlier one just shows longer), then
// quantize each frame to its own 256-color palette.
const unique = [];
for (const f of frames) {
  const png = PNG.sync.read(f.buf);
  const last = unique[unique.length - 1];
  if (last && Buffer.compare(last.png.data, png.data) === 0) continue;
  unique.push({ png, t: f.t });
}
if (process.env.DUMP) {
  mkdirSync(process.env.DUMP, { recursive: true });
  unique.forEach(({ png }, i) => {
    if (i % 8 === 0 || i === unique.length - 1) writeFileSync(`${process.env.DUMP}/frame-${String(i).padStart(3, "0")}.png`, PNG.sync.write(png));
  });
}
const gif = GIFEncoder();
unique.forEach(({ png, t }, i) => {
  // The jump from the third question to the results is shown as a short cut.
  const next = unique[i + 1];
  const delay = next ? Math.min(next.t - t, 1500) : 3500;
  const rgba = new Uint8Array(png.data);
  const palette = quantize(rgba, 256);
  gif.writeFrame(applyPalette(rgba, palette), png.width, png.height, { palette, delay: Math.max(20, delay) });
});
gif.finish();
mkdirSync("docs", { recursive: true });
writeFileSync("docs/demo.gif", gif.bytes());
console.log(`docs/demo.gif: ${unique.length} frames, ${(gif.bytes().length / 1024).toFixed(0)} KB`);
