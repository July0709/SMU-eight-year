// Screenshot the dev site with headless Edge for visual validation.
// Usage: node scripts/shoot.mjs [url] [outDir]
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const url = process.argv[2] || "http://localhost:3000";
const outDir = process.argv[3] || "shots";
mkdirSync(outDir, { recursive: true });

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--force-device-scale-factor=1"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle0", timeout: 90000 });
  await sleep(2500);

  await page.screenshot({ path: `${outDir}/01-hero.png` });

  const stops = [
    ["#fragment", "02-fragment"],
    ["#sys-循环", "04-system-cv"],
    ["#sys-呼吸", "05-system-rs"],
    ["#sys-消化", "06-system-gi"],
    ["#sys-技能", "07-system-cs"],
    ["#illuminate", "08-illuminate"],
    ["#library", "09-library"],
  ];
  for (const [selector, name] of stops) {
    await page.evaluate((sel) => {
      document.querySelector(sel)?.scrollIntoView({ behavior: "instant", block: "start" });
    }, selector);
    await sleep(1400);
    await page.screenshot({ path: `${outDir}/${name}.png` });
    // Mid-morph capture between fragment and the first system chapter.
    if (selector === "#fragment") {
      await page.evaluate(() => {
        const a = document.querySelector("#fragment");
        const b = document.querySelector("#sys-循环");
        if (!a || !b) return;
        const center = (el) => el.offsetTop + el.offsetHeight / 2;
        window.scrollTo(0, (center(a) + center(b)) / 2 - window.innerHeight / 2);
      });
      await sleep(1200);
      await page.screenshot({ path: `${outDir}/03-morph-scatter-heart.png` });
    }
  }

  // Scroll deeper into the library grid
  await page.evaluate(() => window.scrollBy(0, 900));
  await sleep(900);
  await page.screenshot({ path: `${outDir}/10-library-grid.png` });

  // Footer
  await page.evaluate(() => {
    document.querySelector("footer")?.scrollIntoView({ behavior: "instant", block: "end" });
  });
  await sleep(900);
  await page.screenshot({ path: `${outDir}/11-footer.png` });

  // Open the first note card to capture the viewer
  await page.evaluate(() => window.scrollTo(0, 0));
  const clicked = await page.evaluate(() => {
    const card = document.querySelector(".note-card");
    if (card) { card.click(); return true; }
    return false;
  });
  if (clicked) {
    await sleep(1500);
    await page.screenshot({ path: `${outDir}/12-viewer.png` });
  }

  // Mobile pass
  await page.evaluate(() => { window.location.hash = ""; });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: "networkidle0", timeout: 90000 });
  await sleep(1800);
  await page.screenshot({ path: `${outDir}/13-mobile-hero.png` });
  await page.evaluate(() => {
    document.querySelector("#sys-呼吸")?.scrollIntoView({ behavior: "instant" });
  });
  await sleep(1200);
  await page.screenshot({ path: `${outDir}/14-mobile-system.png` });
  await page.evaluate(() => {
    document.querySelector("#library")?.scrollIntoView({ behavior: "instant" });
  });
  await sleep(1000);
  await page.screenshot({ path: `${outDir}/15-mobile-library.png` });

  console.log("shots done");
} finally {
  await browser.close();
}
