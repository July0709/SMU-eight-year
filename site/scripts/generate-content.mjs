import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const siteRoot = process.cwd();
const repoRoot = path.resolve(siteRoot, "..");
const outputRoot = path.join(siteRoot, "public", "library");
const thumbRoot = path.join(siteRoot, "public", "thumbs");
const categories = ["循环系统", "呼吸系统", "消化系统", "临床技能模块二"];
const supported = new Set([".md", ".jpg", ".jpeg", ".png", ".pdf"]);
const shouldCopy = process.argv.includes("--copy");

const rawNotes = [];
const articleImageRefs = new Map(); // article relative path -> Set of referenced filenames

if (shouldCopy) {
  await rm(outputRoot, { recursive: true, force: true });
  await rm(thumbRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  await mkdir(thumbRoot, { recursive: true });
}

function encodeSegments(filePath) {
  return filePath.split(path.sep).map(encodeURIComponent).join("/");
}

function makeUrl(relative) {
  return `library/${encodeSegments(relative)}`;
}

function makeThumbUrl(relative) {
  const parsed = path.parse(relative);
  return `thumbs/${encodeSegments(path.join(parsed.dir, `${parsed.name}.webp`))}`;
}

function makeThumbPath(relative) {
  const parsed = path.parse(relative);
  return path.join(thumbRoot, parsed.dir, `${parsed.name}.webp`);
}

function extractImageRefs(content) {
  const refs = new Set();
  const matches = content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g);
  for (const match of matches) {
    const src = match[1].trim();
    if (!src.startsWith("http") && !src.startsWith("data:")) {
      refs.add(decodeURIComponent(path.basename(src)));
    }
  }
  return refs;
}

async function walk(directory, category) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }));

  for (const entry of entries) {
    const source = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(source, category);
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!supported.has(extension)) continue;

    const relative = path.relative(repoRoot, source);
    const fileStat = await stat(source);
    const kind = extension === ".md" ? "article" : extension === ".pdf" ? "pdf" : "image";
    const title = path.basename(entry.name, extension).replace(/^\d+[.．]\s*/, "");
    const content = kind === "article" ? await readFile(source, "utf8") : "";
    const nested = path.dirname(relative).split(path.sep).slice(1).join(" · ");

    if (kind === "article") {
      articleImageRefs.set(relative, extractImageRefs(content));
    }

    rawNotes.push({
      relative,
      category,
      section: nested || category,
      title,
      fileName: entry.name,
      kind,
      url: makeUrl(relative),
      content,
      size: fileStat.size,
      source,
    });
  }
}

for (const category of categories) {
  await walk(path.join(repoRoot, category), category);
}

// Determine which image/PDF files are referenced as inline attachments by an article in the same folder.
const attachmentSet = new Set();
for (const note of rawNotes) {
  if (note.kind !== "article") continue;
  const noteDir = path.dirname(note.relative);
  const refs = articleImageRefs.get(note.relative) || new Set();
  for (const ref of refs) {
    attachmentSet.add(path.join(noteDir, ref).replaceAll(path.sep, "/"));
  }
}

// Group numbered image series, e.g. "心率失常-2" .. "心率失常-7".
const seriesMap = new Map(); // series key -> array of image notes
const seriesGrouped = new Set();

for (const note of rawNotes) {
  if (note.kind !== "image") continue;
  const base = note.title;
  const match = base.match(/^(.*)[-_](\d+)$/);
  if (match) {
    const key = `${note.category}/${match[1]}`;
    if (!seriesMap.has(key)) seriesMap.set(key, []);
    seriesMap.get(key).push(note);
  }
}

for (const [key, members] of seriesMap) {
  if (members.length < 2) continue;
  members.sort((a, b) => a.title.localeCompare(b.title, "zh-CN", { numeric: true }));
  for (const member of members) seriesGrouped.add(member.relative);
}

async function generateThumbnail(note) {
  if (note.kind !== "image") return undefined;
  const thumbPath = makeThumbPath(note.relative);
  await mkdir(path.dirname(thumbPath), { recursive: true });
  try {
    await sharp(note.source)
      .resize({ width: 480, height: 360, fit: "cover" })
      .webp({ quality: 80 })
      .toFile(thumbPath);
    return makeThumbUrl(note.relative);
  } catch (error) {
    console.warn(`Thumbnail failed for ${note.relative}:`, error.message);
    return undefined;
  }
}

async function copyAsset(note) {
  if (!shouldCopy) return;
  const destination = path.join(outputRoot, note.relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(note.source, destination);
}

const notes = [];
const seriesNotes = [];

for (const note of rawNotes) {
  await copyAsset(note);

  // Skip inline attachments; they will be rendered inside their parent article.
  if (attachmentSet.has(note.relative.replaceAll(path.sep, "/"))) continue;

  // Build standalone note records; series members are deferred and emitted as one grouped card.
  if (seriesGrouped.has(note.relative)) {
    seriesNotes.push(note);
    continue;
  }

  const thumbUrl = note.kind === "image" ? await generateThumbnail(note) : undefined;
  const searchText = `${note.title} ${note.category} ${note.section} ${note.content}`.toLocaleLowerCase("zh-CN");

  notes.push({
    id: note.relative.replaceAll(path.sep, "/"),
    category: note.category,
    section: note.section,
    title: note.title,
    fileName: note.fileName,
    kind: note.kind,
    url: note.url,
    thumbUrl,
    content: note.content,
    size: note.size,
    searchText,
  });
}

// Emit grouped series cards.
const groupedKeys = new Map();
for (const note of seriesNotes) {
  const seriesBase = note.title.replace(/[-_]\d+$/, "").trim();
  const key = `${note.category}/${seriesBase}`;
  if (!groupedKeys.has(key)) groupedKeys.set(key, { base: seriesBase, members: [] });
  groupedKeys.get(key).members.push(note);
}

for (const [key, { base, members }] of groupedKeys) {
  members.sort((a, b) => a.title.localeCompare(b.title, "zh-CN", { numeric: true }));
  const first = members[0];
  const thumbs = await Promise.all(members.map(generateThumbnail));

  notes.push({
    id: `series:${key}`,
    category: first.category,
    section: first.section,
    title: base,
    fileName: members.map((m) => m.fileName).join(", "),
    kind: "image",
    url: first.url,
    seriesUrls: members.map((m) => m.url),
    thumbUrl: thumbs.find(Boolean),
    content: "",
    size: members.reduce((sum, m) => sum + m.size, 0),
    searchText: `${base} ${first.category} ${first.section} ${members.map((m) => m.title).join(" ")}`.toLocaleLowerCase("zh-CN"),
  });
}

const generated = `// Generated by scripts/generate-content.mjs
export type NoteKind = "article" | "image" | "pdf";

export type NoteRecord = {
  id: string;
  category: string;
  section: string;
  title: string;
  fileName: string;
  kind: NoteKind;
  url: string;
  thumbUrl?: string;
  seriesUrls?: string[];
  content: string;
  size: number;
  searchText: string;
};

export const notes = ${JSON.stringify(notes, null, 2)} satisfies NoteRecord[];
`;

await writeFile(path.join(siteRoot, "app", "notes-data.ts"), generated, "utf8");
console.log(`Prepared ${notes.length} notes across ${categories.length} systems${shouldCopy ? " with public assets" : ""}.`);
