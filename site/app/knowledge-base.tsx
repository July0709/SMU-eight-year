"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { notes, type NoteKind, type NoteRecord } from "./notes-data";

const categoryMeta: Record<string, { code: string; description: string; accent: string }> = {
  循环系统: { code: "CV", description: "心衰、高血压、瓣膜与血管", accent: "#5266eb" },
  呼吸系统: { code: "RS", description: "内科、病生与影像辨识", accent: "#6b7fd9" },
  消化系统: { code: "GI", description: "内外科、药理与机制", accent: "#8a96f5" },
  临床技能模块二: { code: "CS", description: "临床思维、检验与操作", accent: "#4a5ed4" },
};

const kindLabel: Record<NoteKind, string> = {
  article: "文字笔记",
  image: "图像资料",
  pdf: "PDF 讲义",
};

function formatSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function assetBase(note: NoteRecord) {
  return note.url.slice(0, note.url.lastIndexOf("/") + 1);
}

function renderInline(text: string, note: NoteRecord): ReactNode[] {
  const tokenPattern = /(!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g;
  return text.split(tokenPattern).filter(Boolean).map((part, index) => {
    const image = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      const src = image[2].startsWith("http") ? image[2] : `${assetBase(note)}${encodeURIComponent(image[2])}`;
      return <img className="inline-note-image" src={src} alt={image[1] || "笔记插图"} key={index} />;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <a href={link[2]} target="_blank" rel="noreferrer" key={index}>{link[1]}</a>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function MarkdownArticle({ note }: { note: NoteRecord }) {
  const lines = note.content.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let listItems: ReactNode[] = [];

  const flushList = () => {
    if (listItems.length) {
      blocks.push(<ul key={`list-${blocks.length}`}>{listItems}</ul>);
      listItems = [];
    }
  };

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) { flushList(); return; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushList();
      const level = Math.min(4, heading[1].length + 1);
      const Tag = `h${level}` as "h2" | "h3" | "h4";
      blocks.push(<Tag key={index}>{renderInline(heading[2], note)}</Tag>);
      return;
    }
    const list = line.match(/^(?:[-+*]|\d+[.)])\s+(.+)$/);
    if (list) {
      listItems.push(<li key={index}>{renderInline(list[1], note)}</li>);
      return;
    }
    flushList();
    if (line.startsWith(">")) {
      blocks.push(<blockquote key={index}>{renderInline(line.replace(/^>\s?/, ""), note)}</blockquote>);
      return;
    }
    if (/^[-| :]+$/.test(line)) return;
    blocks.push(<p key={index}>{renderInline(line, note)}</p>);
  });
  flushList();
  return <div className="article-body">{blocks}</div>;
}

function NoteViewer({ note, onClose }: { note: NoteRecord; onClose: () => void }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", close);
    document.body.classList.add("viewer-open");
    return () => { document.removeEventListener("keydown", close); document.body.classList.remove("viewer-open"); };
  }, [onClose]);

  return (
    <div className="viewer-backdrop" role="dialog" aria-modal="true" aria-label={note.title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className={`viewer viewer-${note.kind}`}>
        <header className="viewer-header">
          <div>
            <span className="viewer-kicker">{note.category} / {kindLabel[note.kind]}</span>
            <h2>{note.title}</h2>
          </div>
          <div className="viewer-actions">
            <a href={note.url} target="_blank" rel="noreferrer">查看原文件</a>
            <button onClick={onClose} aria-label="关闭笔记">×</button>
          </div>
        </header>
        <div className="viewer-content">
          {note.kind === "article" && <MarkdownArticle note={note} />}
          {note.kind === "image" && <img className="focus-image" src={note.url} alt={note.title} />}
          {note.kind === "pdf" && <iframe src={note.url} title={note.title} />}
        </div>
      </section>
    </div>
  );
}

export default function KnowledgeBase() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [kind, setKind] = useState<"all" | NoteKind>("all");
  const [activeNote, setActiveNote] = useState<NoteRecord | null>(null);

  const categories = Object.keys(categoryMeta);
  const stats = useMemo(() => ({
    articles: notes.filter((note) => note.kind === "article").length,
    images: notes.filter((note) => note.kind === "image").length,
    systems: categories.length,
  }), [categories.length]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("zh-CN");
    return notes.filter((note) => {
      const inCategory = category === "全部" || note.category === category;
      const inKind = kind === "all" || note.kind === kind;
      const haystack = `${note.title} ${note.category} ${note.section} ${note.content}`.toLocaleLowerCase("zh-CN");
      return inCategory && inKind && (!term || haystack.includes(term));
    });
  }, [category, kind, query]);

  const resetFilters = () => { setCategory("全部"); setKind("all"); setQuery(""); };

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="返回首页">
          <span className="brand-mark"><i /><i /></span>
          <span><b>南医八年</b><small>MEDICAL ARCHIVE</small></span>
        </a>
        <nav aria-label="页面导航">
          <a href="#library">资料库</a>
          <a href="#systems">系统索引</a>
          <span className="status"><i />持续整理中</span>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow">SOUTHERN MEDICAL UNIVERSITY · STUDY NOTES</span>
          <h1>让医学知识<br /><em>有迹可循。</em></h1>
          <p>把八年医学学习中的课程笔记、影像资料与临床思维，整理成一座清晰、可检索、随时可回看的个人知识库。</p>
          <a className="primary-cta" href="#library">开始查阅 <span>↘</span></a>
        </div>
        <div className="hero-panel" aria-label="资料统计">
          <div className="panel-grid" />
          <span className="panel-label">ARCHIVE INDEX / 01</span>
          <div className="pulse-line"><i /><i /><i /><i /><i /><i /><i /></div>
          <div className="panel-quote">“记录个人成长历程，<br />让医学之路不再孤单。”</div>
          <div className="hero-stats">
            <div><strong>{String(notes.length).padStart(3, "0")}</strong><span>份资料</span></div>
            <div><strong>{stats.images}</strong><span>张图像</span></div>
            <div><strong>{stats.systems}</strong><span>大模块</span></div>
          </div>
        </div>
      </section>

      <section className="systems" id="systems">
        <div className="section-heading">
          <div><span>01 / SYSTEMS</span><h2>按系统建立知识坐标</h2></div>
          <p>从器官系统到临床技能，让每份资料都回到它应在的位置。</p>
        </div>
        <div className="system-grid">
          {categories.map((name, index) => {
            const meta = categoryMeta[name];
            const count = notes.filter((note) => note.category === name).length;
            return (
              <button className="system-card" key={name} style={{ "--accent": meta.accent } as CSSProperties} onClick={() => { setCategory(name); document.querySelector("#library")?.scrollIntoView({ behavior: "smooth" }); }}>
                <span className="system-number">0{index + 1}</span>
                <span className="system-code">{meta.code}</span>
                <strong>{name}</strong>
                <small>{meta.description}</small>
                <span className="system-count">{count} ITEMS <b>↗</b></span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="library" id="library">
        <div className="section-heading library-heading">
          <div><span>02 / LIBRARY</span><h2>资料库</h2></div>
          <p>检索标题、知识点与正文内容。</p>
        </div>
        <div className="library-toolbar">
          <label className="search-box">
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索：心力衰竭、影像学、无菌术…" aria-label="搜索资料" />
            {query && <button onClick={() => setQuery("")} aria-label="清空搜索">×</button>}
          </label>
          <div className="kind-filter" aria-label="资料类型">
            {([['all', '全部'], ['article', '文字'], ['image', '图像'], ['pdf', 'PDF']] as const).map(([value, label]) => (
              <button key={value} className={kind === value ? "active" : ""} onClick={() => setKind(value)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="category-tabs" aria-label="系统筛选">
          {["全部", ...categories].map((name) => <button key={name} className={category === name ? "active" : ""} onClick={() => setCategory(name)}>{name}</button>)}
        </div>

        <div className="results-meta"><span>RESULT / {String(filtered.length).padStart(2, "0")}</span><span>{category === "全部" ? "所有系统" : category}</span></div>
        {filtered.length ? (
          <div className="note-grid">
            {filtered.map((note, index) => (
              <button className="note-card" key={note.id} onClick={() => setActiveNote(note)}>
                <span className={`note-type type-${note.kind}`}>{kindLabel[note.kind]}</span>
                <span className="note-index">{String(index + 1).padStart(2, "0")}</span>
                {note.kind === "image" && <span className="note-thumb"><img src={note.url} alt="" loading="lazy" /></span>}
                {note.kind !== "image" && <span className="document-lines"><i /><i /><i /><i /></span>}
                <span className="note-content">
                  <strong>{note.title}</strong>
                  <small>{note.section} · {formatSize(note.size)}</small>
                </span>
                <span className="note-open">打开 <b>↗</b></span>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state"><span>∅</span><h3>没有找到匹配资料</h3><p>换一个关键词或重置筛选试试。</p><button onClick={resetFilters}>重置筛选</button></div>
        )}
      </section>

      <footer>
        <div className="footer-brand">南医八年 <span>MEDICAL ARCHIVE</span></div>
        <p>个人学习资料整理 · 内容仅用于学习交流</p>
        <a href="#top">回到顶部 ↑</a>
      </footer>

      {activeNote && <NoteViewer note={activeNote} onClose={() => setActiveNote(null)} />}
    </main>
  );
}
