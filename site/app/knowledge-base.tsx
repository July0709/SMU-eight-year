"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notes, type NoteKind, type NoteRecord } from "./notes-data";
import MarkdownArticle from "./components/markdown-article";
import ImageViewer from "./components/image-viewer";
import ParticleStage from "./components/particle-stage";

const categoryMeta: Record<string, { code: string; description: string; accent: string }> = {
  循环系统: { code: "CV", description: "心衰、高血压、瓣膜与血管", accent: "#0d9488" },
  呼吸系统: { code: "RS", description: "内科、病生与影像辨识", accent: "#0891b2" },
  消化系统: { code: "GI", description: "内外科、药理与机制", accent: "#059669" },
  临床技能模块二: { code: "CS", description: "临床思维、检验与操作", accent: "#7c3aed" },
};

// Narrative system chapters. `id` doubles as the scroll anchor and the
// data-chapter order must match the CHAPTERS table in particle-stage.tsx.
const systemChapters = [
  {
    id: "sys-循环",
    name: "循环系统",
    num: "01",
    align: "left" as const,
    text: "心衰、高血压、瓣膜与血管——从机制到用药，把每一次心悸背后的原因讲清楚。",
  },
  {
    id: "sys-呼吸",
    name: "呼吸系统",
    num: "02",
    align: "right" as const,
    text: "内科、病生与影像辨识——从一口气道的阻塞，到整张胸片的读法。",
  },
  {
    id: "sys-消化",
    name: "消化系统",
    num: "03",
    align: "left" as const,
    text: "内外科、药理与机制——从腹痛鉴别，到肝硬化并发症的完整链条。",
  },
  {
    id: "sys-技能",
    name: "临床技能模块二",
    num: "04",
    align: "right" as const,
    text: "临床思维、检验与操作——把床旁的每一步，练进肌肉记忆里。",
  },
];

const railItems = [
  ["01", "听诊"],
  ["02", "碎片"],
  ["03", "循环"],
  ["04", "呼吸"],
  ["05", "消化"],
  ["06", "技能"],
  ["07", "照亮"],
];

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
  favorite,
  onToggleFavorite,
}: {
  note: NoteRecord;
  index: number;
  query: string;
  onClick: () => void;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  const snippet = note.kind === "article" ? getSnippet(note.content, query) : "";

  return (
    <div className="note-card" role="button" tabIndex={0} onClick={onClick} onKeyDown={(event) => { if (event.key === "Enter") onClick(); }} aria-label={`打开 ${note.title}`}>
      <div className="note-header">
        <span className={`note-type type-${note.kind}`}>{kindLabel[note.kind]}</span>
        <span className="note-index">{String(index + 1).padStart(2, "0")}</span>
        <span
          className={`favorite-button ${favorite ? "active" : ""}`}
          role="button"
          tabIndex={0}
          aria-label={favorite ? "取消收藏" : "收藏资料"}
          aria-pressed={favorite}
          onClick={(event) => { event.stopPropagation(); onToggleFavorite(); }}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onToggleFavorite(); } }}
        >{favorite ? "★" : "☆"}</span>
      </div>

      {note.kind === "image" && note.thumbUrl && (
        <span className="note-thumb">
          {/* Generated local thumbnails do not need the Next image service. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={note.thumbUrl} alt="" loading="lazy" decoding="async" width={480} height={360} />
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
    </div>
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
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (note.kind !== "image" && event.key === "ArrowLeft" && prev) window.location.hash = getNoteHash(prev.id);
      if (note.kind !== "image" && event.key === "ArrowRight" && next) window.location.hash = getNoteHash(next.id);
    };
    document.addEventListener("keydown", close);
    document.body.classList.add("viewer-open");
    contentRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", close);
      document.body.classList.remove("viewer-open");
      previousFocus?.focus({ preventScroll: true });
    };
  }, [note.id, note.kind, onClose, prev, next]);

  const openOriginal = () => window.open(note.url, "_blank", "noopener,noreferrer");

  const imageUrls = note.seriesUrls ?? (note.kind === "image" ? [note.url] : []);
  const [seriesIndex, setSeriesIndex] = useState(0);

  const updateProgress = (element: HTMLDivElement) => {
    const range = element.scrollHeight - element.clientHeight;
    setProgress(range > 0 ? Math.min(100, Math.round((element.scrollTop / range) * 100)) : 100);
  };

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
        <div className="reading-progress" style={{ width: `${progress}%` }} aria-hidden="true" />
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

        <div className="viewer-content" onScroll={(event) => updateProgress(event.currentTarget)}>
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
            <iframe src={note.url} title={note.title} onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.nextElementSibling?.removeAttribute("hidden"); }} />
          )}
          {note.kind === "pdf" && <div className="resource-error" role="alert" hidden><b>PDF 预览加载失败</b><button onClick={openOriginal}>打开原文件</button></div>}
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
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [stateReady, setStateReady] = useState(false);
  const [activeChapter, setActiveChapter] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => Object.keys(categoryMeta), []);

  // Chapter rail: same anchor logic as the particle stage (probe = scrollY + 50vh).
  useEffect(() => {
    let anchors: number[] = [];
    const measure = () => {
      anchors = Array.from(document.querySelectorAll("[data-chapter]")).map(
        (el) => (el as HTMLElement).offsetTop
      );
    };
    let ticking = false;
    const update = () => {
      ticking = false;
      if (!anchors.length) return;
      const probe = window.scrollY + window.innerHeight * 0.5;
      let current = 0;
      for (let k = 0; k < anchors.length; k++) {
        if (probe >= anchors[k]) current = k;
      }
      setActiveChapter((prev) => (prev === current ? prev : current));
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    measure();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Reveal chapter copy when it enters the viewport.
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.22 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("smu-archive-state") ?? "{}");
        if (typeof saved.query === "string") setQuery(saved.query);
        if (["全部", ...categories].includes(saved.category)) setCategory(saved.category);
        if (["all", "article", "image", "pdf"].includes(saved.kind)) setKind(saved.kind);
        setFavorites(new Set(Array.isArray(saved.favorites) ? saved.favorites : []));
        setRecentIds(Array.isArray(saved.recentIds) ? saved.recentIds : []);
      } catch { /* Ignore damaged local state. */ }
      setStateReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [categories]);

  useEffect(() => {
    if (!stateReady) return;
    localStorage.setItem("smu-archive-state", JSON.stringify({ query, category, kind, favorites: [...favorites], recentIds }));
  }, [query, category, kind, favorites, recentIds, stateReady]);

  // Sync hash with active note.
  useEffect(() => {
    const sync = () => {
      const id = parseNoteHash();
      setActiveNoteId(id);
      if (id && notes.some((note) => note.id === id)) setRecentIds((current) => [id, ...current.filter((item) => item !== id)].slice(0, 8));
    };
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
      return inCategory && inKind && match && (!favoritesOnly || favorites.has(note.id));
    });
  }, [category, kind, query, favorites, favoritesOnly]);

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

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="返回首页">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>
            <b>南医八年</b>
            <small>Medical Archive</small>
          </span>
        </a>
        <nav aria-label="页面导航">
          <a className="nav-link" href="#library">资料库</a>
          <a className="nav-link" href="#sys-循环">系统索引</a>
          <span className="status">
            <i />持续整理中
          </span>
        </nav>
      </header>

      <ParticleStage />

      <nav className="chapter-rail" aria-label="章节导航">
        {railItems.map(([num, label], index) => (
          <a
            key={num}
            href={["#top", "#fragment", "#sys-循环", "#sys-呼吸", "#sys-消化", "#sys-技能", "#illuminate"][index]}
            className={activeChapter === index ? "active" : ""}
          >
            <i>{num}</i>
            <b>{label}</b>
          </a>
        ))}
      </nav>

      <section className="hero" id="top" data-chapter>
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="eyebrow"> 2023–2031 · A MEDICAL LEARNING JOURNEY </span>
            <h1>
              八年求索，
              <br />
              <em>让知识彼此</em>
              <em className="keep">
                照亮
                <span className="dot">。</span>
              </em>
            </h1>
            <p>
              从第一张解剖图，到一次次临床判断。这里收拢八年医学学习中散落的笔记、影像与思考，让每一次回看都离答案更近一步。
            </p>
            <a className="primary-cta" href="#library">
              开始查阅 <span>→</span>
            </a>
          </div>

        </div>
        <div className="hero-index" aria-label="资料概览">
          <span>ARCHIVE / 01</span>
          <p><b>{String(notes.length).padStart(3, "0")}</b> 份资料</p>
          <p><b>{stats.images}</b> 张图像</p>
          <p><b>{stats.systems}</b> 个知识模块</p>
          <span className="scroll-cue">SCROLL TO EXPLORE ↓</span>
        </div>
      </section>

      <section className="chapter chapter-fragment" id="fragment" data-chapter>
        <p className="fragment-copy reveal">
          八年，上千个知识点，
          <br />
          散落在几十个系统与笔记本里。
          <br />
          <span className="fragment-turn">—— 直到它们被重新连成系统。</span>
        </p>
      </section>

      {systemChapters.map((chapter) => {
        const meta = categoryMeta[chapter.name];
        const count = notes.filter((note) => note.category === chapter.name).length;
        return (
          <section key={chapter.id} className="chapter system-chapter" id={chapter.id} data-chapter>
            <div className="chapter-inner">
              <div className={`chapter-copy reveal${chapter.align === "right" ? " right" : ""}`}>
                <span className="chapter-tag">
                  SYSTEM {chapter.num} / {meta.code}
                </span>
                <h2 className="chapter-title">
                  {chapter.name === "临床技能模块二" ? (
                    <>
                      临床技能
                      <span className="keep">
                        模块二<span className="dot">。</span>
                      </span>
                    </>
                  ) : (
                    <>
                      {chapter.name}
                      <span className="dot">。</span>
                    </>
                  )}
                </h2>
                <p className="chapter-desc">{chapter.text}</p>
                <button className="chapter-cta" onClick={() => setCategoryAndScroll(chapter.name)}>
                  {count} 份资料 <b>→</b>
                </button>
              </div>
            </div>
          </section>
        );
      })}

      <section className="chapter chapter-illuminate" id="illuminate" data-chapter>
        <div className="chapter-inner">
          <div className="chapter-copy center reveal">
            <span className="chapter-tag">FINALE / LIGHT</span>
            <h2 className="chapter-title">
              让知识彼此照亮<span className="dot">。</span>
            </h2>
            <div className="stat-row" aria-label="资料统计">
              <div>
                <b>{String(notes.length).padStart(2, "0")}</b>
                <span>份资料</span>
              </div>
              <div>
                <b>{stats.images}</b>
                <span>张图像</span>
              </div>
              <div>
                <b>{stats.systems}</b>
                <span>个模块</span>
              </div>
              <div>
                <b>{favorites.size}</b>
                <span>份收藏</span>
              </div>
            </div>
            {recentIds.length > 0 && (
              <div className="recent-strip illuminate-recent" aria-label="最近浏览">
                <span>最近浏览</span>
                {recentIds.flatMap((id) => {
                  const note = notes.find((item) => item.id === id);
                  return note ? [note] : [];
                }).map((note) => (
                  <button key={note.id} onClick={() => (window.location.hash = getNoteHash(note.id))}>{note.title}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section library" id="library">
        <div className="section-inner">
          <div className="section-heading">
            <div>
              <span>02 / Library</span>
              <h2>找到此刻<br />真正需要的<span className="keep">答案<span className="dot">。</span></span></h2>
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
            <button className={`favorites-filter ${favoritesOnly ? "active" : ""}`} onClick={() => setFavoritesOnly((value) => !value)} aria-pressed={favoritesOnly}>
              ★ 收藏 {favorites.size}
            </button>
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
                  favorite={favorites.has(note.id)}
                  onToggleFavorite={() => toggleFavorite(note.id)}
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
          {!query && !favoritesOnly && recentIds.length > 0 && (
            <div className="recent-strip" aria-label="最近浏览">
              <span>最近浏览</span>
              {recentIds.flatMap((id) => {
                const note = notes.find((item) => item.id === id);
                return note ? [note] : [];
              }).map((note) => (
                <button key={note.id} onClick={() => (window.location.hash = getNoteHash(note.id))}>{note.title}</button>
              ))}
            </div>
          )}
        </div>
      </section>

      <footer>
        <blockquote className="footer-quote">
          <p>“我体验过了，我倾尽全力奋斗过了，我对自己算是有交代了，而我那么努力，是为了获得更自由。”</p>
          <cite>—— 詹青云</cite>
        </blockquote>
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
          key={activeNote.id}
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
