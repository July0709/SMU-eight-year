// One-shot validation: serve github-pages-dist, open in headless Edge,
// verify the library section reflects the synced notes, screenshot, exit.
import puppeteer from "puppeteer-core";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { mkdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";

const distRoot = path.resolve("github-pages-dist");
const base = "/SMU-eight-year/";
const outDir = path.resolve("shots");
mkdirSync(outDir, { recursive: true });

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (urlPath.startsWith(base)) urlPath = urlPath.slice(base.length - 1);
    if (urlPath.endsWith("/")) urlPath += "index.html";
    const file = path.join(distRoot, urlPath);
    if (!file.startsWith(distRoot) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": mime[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch (error) {
    res.writeHead(500).end(String(error));
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const url = `http://127.0.0.1:${port}${base}`;

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--force-device-scale-factor=1"],
});

const failures = [];
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("console", (msg) => {
    if (msg.type() === "error") pageErrors.push(msg.text());
  });
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle0", timeout: 90000 });
  await sleep(2500);

  const report = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll(".category-tabs button")].map((b) => b.textContent.trim());
    const meta = document.querySelector(".results-meta span")?.textContent.trim();
    const cards = document.querySelectorAll(".note-card").length;
    const heroCount = document.querySelector(".hero-index b")?.textContent.trim();
    return { tabs, meta, cards, heroCount };
  });
  console.log("tabs:", JSON.stringify(report.tabs));
  console.log("results-meta:", report.meta, "| cards rendered:", report.cards, "| hero count:", report.heroCount);

  if (report.tabs.length !== 18) failures.push(`expected 18 category tabs, got ${report.tabs.length}`);
  for (const name of ["神经系统", "内分泌系统", "感染与防御", "临床技能模块三", "医学遗传学", "医学心理学", "医学伦理学", "概率论与数理统计", "毛概", "有机化学", "医学文献管理与检索", "系统解剖学"]) {
    if (!report.tabs.includes(name)) failures.push(`missing category tab: ${name}`);
  }
  if (!report.meta?.includes("164")) failures.push(`expected RESULT / 164, got: ${report.meta}`);
  if (report.cards < 10) failures.push(`too few cards rendered: ${report.cards}`);

  // Switch to a newly added category and confirm filtering works.
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll(".category-tabs button")].find((b) => b.textContent.trim() === "系统解剖学");
    tab?.click();
  });
  await sleep(600);
  const filteredMeta = await page.evaluate(() => document.querySelector(".results-meta span")?.textContent.trim());
  console.log("系统解剖学 filter:", filteredMeta);
  if (!filteredMeta || filteredMeta.includes("164")) failures.push(`category filter did not change results: ${filteredMeta}`);

  // Screenshot the library section.
  await page.evaluate(() => document.querySelector(".category-tabs button")?.click());
  await sleep(500);
  await page.evaluate(() => document.querySelector("#library")?.scrollIntoView({ behavior: "instant", block: "start" }));
  await sleep(1500);
  await page.screenshot({ path: path.join(outDir, "sync-library.png") });
  await page.evaluate(() => window.scrollBy(0, 900));
  await sleep(900);
  await page.screenshot({ path: path.join(outDir, "sync-library-grid.png") });

  // Open one note from a newly converted category to verify the PDF viewer works.
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll(".category-tabs button")].find((b) => b.textContent.trim() === "医学伦理学");
    tab?.click();
  });
  await sleep(600);
  await page.evaluate(() => document.querySelector(".note-card")?.click());
  await sleep(2500);
  const viewerOpen = await page.evaluate(() => Boolean(document.querySelector(".viewer")));
  const pdfFrame = await page.evaluate(() => Boolean(document.querySelector(".viewer-pdf iframe")));
  await page.screenshot({ path: path.join(outDir, "sync-viewer.png") });
  if (!viewerOpen) failures.push("note viewer did not open for a converted note");
  if (!pdfFrame) failures.push("converted note is not rendered as a PDF viewer");

  const realErrors = pageErrors.filter((e) => !e.includes("favicon"));
  if (realErrors.length) failures.push(`page errors: ${realErrors.slice(0, 3).join(" | ")}`);
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error("VALIDATION FAILED:");
  for (const failure of failures) console.error(" -", failure);
  process.exit(1);
}
console.log("VALIDATION PASSED");
