"use client";

import { useMemo } from "react";
import { marked } from "marked";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { NoteRecord } from "../notes-data";

marked.use({
  gfm: true,
  breaks: false,
  pedantic: false,
});

function assetBase(note: NoteRecord) {
  return note.url.slice(0, note.url.lastIndexOf("/") + 1);
}

function renderMath(text: string, displayMode: boolean): string {
  try {
    return katex.renderToString(text, {
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return text;
  }
}

function processMath(source: string): string {
  // Replace display math $$...$$
  let html = source.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => renderMath(math.trim(), true));
  // Replace inline math $...$ (avoid escaped dollars and already-processed display blocks)
  html = html.replace(/(?<!\$)\$([^\$\n]+?)\$(?!\$)/g, (_, math) => renderMath(math.trim(), false));
  return html;
}

export default function MarkdownArticle({
  note,
  onInlineImageClick,
}: {
  note: NoteRecord;
  onInlineImageClick?: (src: string, alt: string) => void;
}) {
  const content = useMemo(() => {
    let raw = note.content;
    // Resolve relative image URLs to the note's asset base
    raw = raw.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
      if (src.startsWith("http") || src.startsWith("data:")) return match;
      const resolved = `${assetBase(note)}${encodeURIComponent(decodeURIComponent(src))}`;
      return `![${alt}](${resolved})`;
    });

    const withMath = processMath(raw);
    const slugCounts = new Map<string, number>();
    const renderer = new marked.Renderer();
    renderer.heading = (text, depth) => {
      const base = text.replace(/<[^>]+>/g, "").trim().replace(/\s+/g, "-").replace(/[^\w\u4e00-\u9fff-]/g, "") || "section";
      const count = slugCounts.get(base) ?? 0;
      slugCounts.set(base, count + 1);
      const id = count ? `${base}-${count + 1}` : base;
      return `<h${depth} id="${id}">${text}</h${depth}>`;
    };
    const html = (marked(withMath, { async: false, renderer }) as string)
      .replace(/<img\b/g, '<img class="inline-note-image" loading="lazy" decoding="async"')
      .replace(/<a\s+href="(https?:[^\"]+)"/g, '<a target="_blank" rel="noopener noreferrer" href="$1"');

    return html;
  }, [note]);

  const handleClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    const img = target.closest("img");
    if (img?.classList.contains("inline-note-image")) {
      event.preventDefault();
      onInlineImageClick?.(img.src, img.alt);
    }
  };

  return (
    <article className="article-body" onClick={handleClick} dangerouslySetInnerHTML={{ __html: content }} />
  );
}
