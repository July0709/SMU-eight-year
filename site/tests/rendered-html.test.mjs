import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("builds the medical archive application", async () => {
  const [page, archive, data, layout] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/knowledge-base.tsx", root), "utf8"),
    readFile(new URL("app/notes-data.ts", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
  ]);

  assert.match(page, /<KnowledgeBase\s*\/>/);
  assert.match(layout, /南医八年/);
  assert.match(archive, /smu-archive-state/);
  assert.match(archive, /getNoteHash/);
  assert.match(archive, /aria-modal="true"/);
  assert.match(data, /export const notes/);
  assert.ok((data.match(/"id":/g) ?? []).length >= 50);
});

test("keeps required public resources available", async () => {
  await Promise.all([
    access(new URL("public/favicon.svg", root)),
    access(new URL("public/og.png", root)),
    access(new URL("public/library", root)),
    access(new URL("public/thumbs", root)),
  ]);
});

test("keeps both deployment targets configured", async () => {
  const [packageJson, pagesConfig] = await Promise.all([
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("vite.github-pages.config.ts", root), "utf8"),
  ]);
  assert.match(packageJson, /"build": "vinext build"/);
  assert.match(packageJson, /"build:pages"/);
  assert.match(pagesConfig, /base: "\/SMU-eight-year\/"/);
});
