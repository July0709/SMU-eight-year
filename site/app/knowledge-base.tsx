"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { notes, type NoteKind, type NoteRecord } from "./notes-data";
import MarkdownArticle from "./components/markdown-article";
import ImageViewer from "./components/image-viewer";

const categoryMeta: Record<string, { code: string; description: string; accent: string }> = {
  循环系统: { code: "CV", description: "心衰、高血压、瓣膜与血管", accent: "#0d9488" },
  呼吸系统: { code: "RS", description: "内科、病生与影像辨识", accent: "#0891b2" },
  消化系统: { code: "GI", description: "内外科、药理与机制", accent: "#059669" },
  临床技能模块二: { code: "CS", description: "临床思维、检验与操作", accent: "#7c3aed" },
};

const kindLabel: Record<NoteKind, string> = {
  article: "文字笔记",
  image: "图像资料",
  pdf: "PDF 讲义",
};

const kindFilterLabel: Record<"all" | NoteKind, string> = {
  all: "全部",
  article: "文字",
  image: "图像",
  pdf: "PDF",
};

function formatSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function encodeNoteId(id: string) {
  return encodeURIComponent(id).replace(/%2F/g, "~");
}

function decodeNoteId(encoded: string) {
  return decodeURIComponent(encoded.replace(/~/g, "%2F"));
}

function getNoteHash(id: string) {
  return `#note=${encodeNoteId(id)}`;
}

function parseNoteHash() {
  if (typeof window === "undefined") return null;
  const match = window.location.hash.match(/^#note=(.+)$/);
  return match ? decodeNoteId(match[1]) : null;
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, term }: { text: string; term: string }) {
  if (!term.trim()) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(term)})`, "gi"));
  return parts.map((part, index) =>
    part.toLowerCase() === term.toLowerCase() ? (
      <span key={index} className="search-highlight">{part}</span>
    ) : (
      part
    )
  );
}

function getSnippet(content: string, term: string, maxLength = 120): string {
  if (!term.trim()) return content.slice(0, maxLength).replace(/\s+/g, " ").trim();
  const lower = content.toLowerCase();
  const index = lower.indexOf(term.toLowerCase());
  if (index === -1) return content.slice(0, maxLength).replace(/\s+/g, " ").trim();
  const start = Math.max(0, index - maxLength / 2);
  const end = Math.min(content.length, index + term.length + maxLength / 2);
  let snippet = content.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) snippet = "…" + snippet;
  if (end < content.length) snippet = snippet + "…";
  return snippet;
}

function NoteCard({
  note,
  index,
  query,
  onClick,
}: {
  note: NoteRecord;
  index: number;
  query: string;
  onClick: () => void;
}) {
  const snippet = note.kind === "article" ? getSnippet(note.content, query) : "";

  return (
    <button className="note-card" onClick={onClick} aria-label={`打开 ${note.title}`}>
      <div className="note-header">
        <span className={`note-type type-${note.kind}`}>{kindLabel[note.kind]}</span>
        <span className="note-index">{String(index + 1).padStart(2, "0")}</span>
      </div>

      {note.kind === "image" && note.thumbUrl && (
        <span className="note-thumb">
          <img src={note.thumbUrl} alt="" loading="lazy" width={480} height={360} />
        </span>
      )}
      {note.kind === "image" && !note.thumbUrl && (
        <span className="document-lines">
          <i /><i /><i /><i />
        </span>
      )}
      {note.kind !== "image" && (
        <span className="document-lines">
          <i /><i /><i /><i />
        </span>
      )}

      {note.kind === "article" && snippet && (
        <p className="note-excerpt">{query ? <Highlight text={snippet} term={query} /> : snippet}</p>
      )}

      <span className="note-content">
        <strong>{query ? <Highlight text={note.title} term={query} /> : note.title}</strong>
        <small>
          {note.section} · {formatSize(note.size)}
          {note.seriesUrls && ` · ${note.seriesUrls.length} 张`}
        </small>
      </span>

      <span className="note-open">
        打开 <b>→</b>
      </span>
    </button>
  );
}

function NoteViewer({
  note,
  filtered,
  onClose,
}: {
  note: NoteRecord;
  filtered: NoteRecord[];
  onClose: () => void;
}) {
  const currentIndex = filtered.findIndex((n) => n.id === note.id);
  const prev = currentIndex > 0 ? filtered[currentIndex - 1] : null;
  const next = currentIndex < filtered.length - 1 ? filtered[currentIndex + 1] : null;
  const contentRef = useRef<HTMLDivElement>(null);
  const [inlineImage, setInlineImage] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && prev) window.location.hash = getNoteHash(prev.id);
      if (event.key === "ArrowRight" && next) window.location.hash = getNoteHash(next.id);
    };
    document.addEventListener("keydown", close);
    document.body.classList.add("viewer-open");
    contentRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", close);
      document.body.classList.remove("viewer-open");
    };
  }, [note.id, onClose, prev, next]);

  const openOriginal = () => window.open(note.url, "_blank", "noopener,noreferrer");

  const imageUrls = note.seriesUrls ?? (note.kind === "image" ? [note.url] : []);
  const [seriesIndex, setSeriesIndex] = useState(0);

  useEffect(() => {
    setSeriesIndex(0);
  }, [note.id]);

  return (
    <div
      className="viewer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={note.title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className={`viewer viewer-${note.kind}`} tabIndex={-1} ref={contentRef}>
        <header className="viewer-header">
          <div>
            <span className="viewer-kicker">
              {note.category} / {kindLabel[note.kind]}
              {note.seriesUrls && ` · ${seriesIndex + 1} / ${note.seriesUrls.length}`}
            </span>
            <h2>{note.title}</h2>
          </div>
          <div className="viewer-actions">
            <button onClick={openOriginal}>查看原文件</button>
            <button className="primary" onClick={onClose} aria-label="关闭">✕</button>
          </div>
        </header>

        <div className="viewer-content">
          {note.kind === "article" && (
            <>
              {inlineImage ? (
                <ImageViewer
                  src={inlineImage.src}
                  alt={inlineImage.alt}
                  onClose={() => setInlineImage(null)}
                />
              ) : note.content.trim() ? (
                <MarkdownArticle
                  note={note}
                  onInlineImageClick={(src, alt) => setInlineImage({ src, alt })}
                />
              ) : (
                <div className="article-body">
                  <p style={{ color: "var(--text-muted)" }}>这份资料暂时没有内容，点击右上角“查看原文件”获取完整信息。</p>
                </div>
              )}
            </>
          )}
          {note.kind === "image" && (
            <ImageViewer
              src={imageUrls[seriesIndex]}
              alt={note.title}
              seriesIndex={seriesIndex}
              seriesCount={imageUrls.length}
              onSeriesPrev={() => setSeriesIndex((i) => Math.max(0, i - 1))}
              onSeriesNext={() => setSeriesIndex((i) => Math.min(imageUrls.length - 1, i + 1))}
            />
          )}
          {note.kind === "pdf" && (
            <iframe src={note.url} title={note.title} />
          )}
        </div>

        <footer className="viewer-nav">
          <button
            disabled={!prev}
            onClick={() => prev && (window.location.hash = getNoteHash(prev.id))}
          >
            ← 上一份
          </button>

          <span>
            {currentIndex >= 0 ? `${currentIndex + 1} / ${filtered.length}` : "-"}
          </span>

          <button
            disabled={!next}
            onClick={() => next && (window.location.hash = getNoteHash(next.id))}
          >
            下一份 →
          </button>
        </footer>
      </section>
    </div>
  );
}

export default function KnowledgeBase() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [kind, setKind] = useState<"all" | NoteKind>("all");
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const categories = Object.keys(categoryMeta);

  // Sync hash with active note.
  useEffect(() => {
    const sync = () => setActiveNoteId(parseNoteHash());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  // Keyboard shortcut: / or Ctrl+K focuses search.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const stats = useMemo(
    () => ({
      articles: notes.filter((note) => note.kind === "article").length,
      images: notes.filter((note) => note.kind === "image").length,
      systems: categories.length,
    }),
    [categories.length]
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("zh-CN");
    return notes.filter((note) => {
      const inCategory = category === "全部" || note.category === category;
      const inKind = kind === "all" || note.kind === kind;
      const match = !term || note.searchText.includes(term);
      return inCategory && inKind && match;
    });
  }, [category, kind, query]);

  const activeNote = useMemo(
    () => (activeNoteId ? notes.find((note) => note.id === activeNoteId) || null : null),
    [activeNoteId]
  );

  const resetFilters = useCallback(() => {
    setCategory("全部");
    setKind("all");
    setQuery("");
  }, []);

  const setCategoryAndScroll = useCallback((name: string) => {
    setCategory(name);
    document.querySelector("#library")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="返回首页">
          <span className="brand-mark">
            <i /><i />
          </span>
          <span>
            <b>南医八年</b>
            <small>Medical Archive</small>
          </span>
        </a>
        <nav aria-label="页面导航">
          <a className="nav-link" href="#library">资料库</a>
          <a className="nav-link" href="#systems">系统索引</a>
          <span className="status">
            <i />持续整理中
          </span>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="eyebrow"> Southern Medical University · Study Notes </span>
            <h1>
              让医学知识
              <br />
              <em>有迹可循。</em>
            </h1>
            <p>
              把八年医学学习中的课程笔记、影像资料与临床思维，整理成一座清晰、可检索、随时可回看的个人知识库。
            </p>
            <a className="primary-cta" href="#library">
              开始查阅 <span>→</span>
            </a>
          </div>

          <div className="hero-stats-card">
            <div className="panel-label">Archive Index / 01</div>
            <div className="hero-stats">
              <div>
                <strong>{String(notes.length).padStart(3, "0")}</strong>
                <span>份资料</span>
              </div>
              <div>
                <strong>{stats.images}</strong>
                <span>张图像</span>
              </div>
              <div>
                <strong>{stats.systems}</strong>
                <span>大模块</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="systems">
        <div className="section-inner">
          <div className="section-heading">
            <div>
              <span>01 / Systems</span>
              <h2>按系统建立知识坐标</h2>
              <p>从器官系统到临床技能，让每份资料都回到它应在的位置。</p>
            </div>
          </div>

          <div className="system-grid">
            {categories.map((name, index) => {
              const meta = categoryMeta[name];
              const count = notes.filter((note) => note.category === name).length;
              return (
                <button
                  key={name}
                  className="system-card"
                  style={{ "--accent": meta.accent } as CSSProperties}
                  onClick={() => setCategoryAndScroll(name)}
                >
                  <span className="system-number">0{index + 1}</span>
                  <span className="system-code">{meta.code}</span>
                  <strong>{name}</strong>
                  <small>{meta.description}</small>
                  <span className="system-count">
                    {count} ITEMS <b>→</b>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section library" id="library">
        <div className="section-inner">
          <div className="section-heading">
            <div>
              <span>02 / Library</span>
              <h2>资料库</h2>
              <p>检索标题、知识点与正文内容。按 / 或 Ctrl+K 快速聚焦搜索。</p>
            </div>
          </div>

          <div className="library-toolbar">
            <label className="search-box">
              <span aria-hidden="true">⌕</span>
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索：心力衰竭、影像学、无菌术…"
                aria-label="搜索资料"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="清空搜索">
                  ✕
                </button>
              )}
            </label>

            <div className="kind-filter" role="group" aria-label="资料类型">
              {(["all", "article", "image", "pdf"] as const).map((value) => (
                <button
                  key={value}
                  className={kind === value ? "active" : ""}
                  onClick={() => setKind(value)}
                  aria-pressed={kind === value}
                >
                  {kindFilterLabel[value]}
                </button>
              ))}
            </div>
          </div>

          <div className="category-tabs" role="tablist" aria-label="系统筛选">
            {["全部", ...categories].map((name) => (
              <button
                key={name}
                role="tab"
                aria-selected={category === name}
                className={category === name ? "active" : ""}
                onClick={() => setCategory(name)}
              >
                {name}
              </button>
            ))}
          </div>

          {(category !== "全部" || kind !== "all" || query) && (
            <div className="active-filters">
              {category !== "全部" && (
                <span className="filter-chip">
                  系统：{category}
                  <button onClick={() => setCategory("全部")} aria-label="清除系统筛选">
                    ✕
                  </button>
                </span>
              )}
              {kind !== "all" && (
                <span className="filter-chip">
                  类型：{kindFilterLabel[kind]}
                  <button onClick={() => setKind("all")} aria-label="清除类型筛选">
                    ✕
                  </button>
                </span>
              )}
              {query && (
                <span className="filter-chip">
                  搜索：{query}
                  <button onClick={() => setQuery("")} aria-label="清除搜索">
                    ✕
                  </button>
                </span>
              )}
              <button
                onClick={resetFilters}
                style={{
                  border: 0,
                  background: "none",
                  color: "var(--text-muted)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                重置全部
              </button>
            </div>
          )}

          <div className="results-meta">
            <span>Result / {String(filtered.length).padStart(2, "0")}</span>
            <span>{category === "全部" ? "所有系统" : category}</span>
          </div>

          {filtered.length ? (
            <div className="note-grid">
              {filtered.map((note, index) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  index={index}
                  query={query}
                  onClick={() => (window.location.hash = getNoteHash(note.id))}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span>∅</span>
              <h3>没有找到匹配资料</h3>
              <p>换一个关键词或重置筛选试试。</p>
              <button onClick={resetFilters}>重置筛选</button>
            </div>
          )}
        </div>
      </section>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand">
            南医八年
            <span>Medical Archive</span>
          </div>
          <p>个人学习资料整理 · 内容仅用于学习交流</p>
          <a href="#top">回到顶部 ↑</a>
        </div>
      </footer>

      {activeNote && (
        <NoteViewer
          note={activeNote}
          filtered={filtered}
          onClose={() => {
            window.location.hash = "";
          }}
        />
      )}
    </main>
  );
}
