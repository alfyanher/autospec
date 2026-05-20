import { readFile, writeFile } from 'fs/promises';
import { join, basename } from 'path';
import { marked } from 'marked';

const CALLOUT_TYPES = ['NOTE', 'TIP', 'WARNING', 'IMPORTANT', 'CAUTION'];

const CALLOUT_ICONS = {
  NOTE: '&#8505;',
  TIP: '&#128161;',
  WARNING: '&#9888;',
  IMPORTANT: '&#128276;',
  CAUTION: '&#9888;',
};

export async function generateHTMLReport(outputDir, projectName, generatedDocs, generatedAt) {
  const sections = [];

  const inlineDocs = generatedDocs.filter((f) => !f.startsWith('../') && f.endsWith('.md'));

  for (const filename of inlineDocs) {
    const id = filename.replace(/\.md$/i, '').toLowerCase().replace(/[^a-z0-9]/g, '-');
    const title = toTitle(filename.replace(/\.md$/i, ''));

    let markdown;
    try {
      markdown = await readFile(join(outputDir, filename), 'utf-8');
    } catch {
      continue;
    }

    const html = markdownToHtml(markdown);
    sections.push({ id, title, html, filename });
  }

  if (sections.length === 0) return;

  const html = buildHTML(projectName, sections, generatedAt);
  await writeFile(join(outputDir, 'index.html'), html, 'utf-8');
}

function markdownToHtml(markdown) {
  const preprocessed = preprocessCallouts(markdown);
  const html = marked.parse(preprocessed);
  return postprocessMermaid(html);
}

function preprocessCallouts(markdown) {
  const pattern = new RegExp(
    `> \\[!(${CALLOUT_TYPES.join('|')})\\]\\n((?:>.*(?:\\n|$))*)`,
    'g'
  );

  return markdown.replace(pattern, (_, type, body) => {
    const inner = body
      .split('\n')
      .map((line) => line.replace(/^>\s?/, ''))
      .join('\n')
      .trim();
    const icon = CALLOUT_ICONS[type] || '';
    const typeLC = type.toLowerCase();
    return `<aside class="callout callout-${typeLC}"><strong>${icon} ${type}</strong>\n\n${inner}</aside>\n\n`;
  });
}

function postprocessMermaid(html) {
  return html.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (_, code) => `<div class="mermaid">${unescapeHtml(code)}</div>`
  );
}

function unescapeHtml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function toTitle(name) {
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildHTML(projectName, sections, generatedAt) {
  const navItems = sections
    .map(
      (s, i) =>
        `<button class="nav-item${i === 0 ? ' active' : ''}" data-doc="${s.id}">${s.title}</button>`
    )
    .join('\n      ');

  const contentSections = sections
    .map(
      (s, i) =>
        `<section id="doc-${s.id}" class="doc-section${i === 0 ? ' active' : ''}">\n${s.html}\n</section>`
    )
    .join('\n\n    ');

  const formattedDate = new Date(generatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeAttr(projectName)} — AutoSpec Docs</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --surface2: #1c2128;
      --border: #30363d;
      --text: #e6edf3;
      --muted: #8b949e;
      --accent: #a78bfa;
      --accent-dim: #6d28d9;
      --link: #58a6ff;
      --code-bg: #1c2128;
      --th-bg: #161b22;
      --callout-note-bg: #1f2d3d;
      --callout-note-border: #388bfd;
      --callout-note-text: #79c0ff;
      --callout-tip-bg: #1a2d22;
      --callout-tip-border: #3fb950;
      --callout-tip-text: #56d364;
      --callout-warning-bg: #2d2008;
      --callout-warning-border: #d29922;
      --callout-warning-text: #e3b341;
      --callout-caution-bg: #2d1517;
      --callout-caution-border: #f85149;
      --callout-caution-text: #ff7b72;
      --callout-important-bg: #271d3f;
      --callout-important-border: #a371f7;
      --callout-important-text: #d2a8ff;
    }

    [data-theme="light"] {
      --bg: #ffffff;
      --surface: #f6f8fa;
      --surface2: #eaeef2;
      --border: #d0d7de;
      --text: #1f2328;
      --muted: #656d76;
      --accent: #7c3aed;
      --accent-dim: #6d28d9;
      --link: #0969da;
      --code-bg: #f6f8fa;
      --th-bg: #f6f8fa;
      --callout-note-bg: #ddf4ff;
      --callout-note-border: #54aeff;
      --callout-note-text: #0550ae;
      --callout-tip-bg: #dafbe1;
      --callout-tip-border: #2da44e;
      --callout-tip-text: #116329;
      --callout-warning-bg: #fff8c5;
      --callout-warning-border: #d4a72c;
      --callout-warning-text: #7d4e00;
      --callout-caution-bg: #ffebe9;
      --callout-caution-border: #ff8182;
      --callout-caution-text: #82071e;
      --callout-important-bg: #fbefff;
      --callout-important-border: #c264f5;
      --callout-important-text: #622cbc;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      height: 100vh;
      overflow: hidden;
      font-size: 15px;
      line-height: 1.6;
    }

    /* ── Sidebar ── */
    #sidebar {
      width: 230px;
      min-width: 230px;
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      padding-bottom: 1rem;
    }

    .sidebar-header {
      padding: 1.25rem 1rem 0.75rem;
      border-bottom: 1px solid var(--border);
    }

    .logo {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 0.3rem;
    }

    .project-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
      word-break: break-word;
    }

    .nav-section-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--muted);
      padding: 1rem 1rem 0.4rem;
    }

    .nav-item {
      display: block;
      width: 100%;
      text-align: left;
      padding: 0.45rem 1rem;
      font-size: 13.5px;
      color: var(--muted);
      background: none;
      border: none;
      cursor: pointer;
      border-radius: 6px;
      margin: 1px 6px;
      width: calc(100% - 12px);
      transition: background 0.15s, color 0.15s;
    }

    .nav-item:hover {
      background: var(--surface2);
      color: var(--text);
    }

    .nav-item.active {
      background: var(--surface2);
      color: var(--accent);
      font-weight: 500;
    }

    /* ── Main ── */
    main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 1.5rem;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .header-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
      flex: 1;
    }

    .generated-at {
      font-size: 12px;
      color: var(--muted);
    }

    #theme-toggle {
      background: var(--surface2);
      border: 1px solid var(--border);
      color: var(--muted);
      padding: 0.3rem 0.7rem;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }

    #theme-toggle:hover {
      color: var(--text);
      border-color: var(--accent);
    }

    #content {
      flex: 1;
      overflow-y: auto;
      padding: 2rem 2.5rem;
      max-width: 960px;
    }

    /* ── Doc sections ── */
    .doc-section { display: none; }
    .doc-section.active { display: block; }

    /* ── Typography ── */
    .doc-section h1 {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 0.75rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border);
    }

    .doc-section h2 {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text);
      margin-top: 2rem;
      margin-bottom: 0.6rem;
      padding-bottom: 0.35rem;
      border-bottom: 1px solid var(--border);
    }

    .doc-section h3 {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text);
      margin-top: 1.5rem;
      margin-bottom: 0.4rem;
    }

    .doc-section h4, .doc-section h5, .doc-section h6 {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--muted);
      margin-top: 1rem;
      margin-bottom: 0.3rem;
    }

    .doc-section p { margin-bottom: 0.9rem; }

    .doc-section a { color: var(--link); text-decoration: none; }
    .doc-section a:hover { text-decoration: underline; }

    .doc-section ul, .doc-section ol {
      padding-left: 1.5rem;
      margin-bottom: 0.9rem;
    }

    .doc-section li { margin-bottom: 0.25rem; }

    .doc-section code {
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
      font-size: 0.85em;
      background: var(--code-bg);
      border: 1px solid var(--border);
      padding: 0.15em 0.4em;
      border-radius: 4px;
      color: var(--accent);
    }

    .doc-section pre {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem 1.25rem;
      overflow-x: auto;
      margin-bottom: 1rem;
    }

    .doc-section pre code {
      background: none;
      border: none;
      padding: 0;
      font-size: 0.85rem;
      color: var(--text);
      line-height: 1.6;
    }

    /* ── Tables ── */
    .doc-section table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1rem;
      font-size: 0.9rem;
      overflow-x: auto;
      display: block;
    }

    .doc-section th {
      background: var(--th-bg);
      text-align: left;
      padding: 0.55rem 0.85rem;
      font-weight: 600;
      border: 1px solid var(--border);
      color: var(--text);
      white-space: nowrap;
    }

    .doc-section td {
      padding: 0.55rem 0.85rem;
      border: 1px solid var(--border);
      vertical-align: top;
    }

    .doc-section tr:nth-child(even) td {
      background: var(--surface);
    }

    /* ── Blockquotes ── */
    .doc-section blockquote {
      border-left: 3px solid var(--accent);
      padding: 0.5rem 1rem;
      color: var(--muted);
      margin-bottom: 0.9rem;
      background: var(--surface);
      border-radius: 0 6px 6px 0;
      font-style: italic;
    }

    /* ── Callouts ── */
    .callout {
      border-radius: 8px;
      padding: 0.85rem 1.1rem;
      margin-bottom: 1rem;
      border-left: 4px solid;
    }

    .callout strong {
      display: block;
      font-size: 0.8rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 0.35rem;
    }

    .callout p { margin-bottom: 0; }

    .callout-note    { background: var(--callout-note-bg);    border-color: var(--callout-note-border);    color: var(--callout-note-text); }
    .callout-tip     { background: var(--callout-tip-bg);     border-color: var(--callout-tip-border);     color: var(--callout-tip-text); }
    .callout-warning { background: var(--callout-warning-bg); border-color: var(--callout-warning-border); color: var(--callout-warning-text); }
    .callout-caution { background: var(--callout-caution-bg); border-color: var(--callout-caution-border); color: var(--callout-caution-text); }
    .callout-important { background: var(--callout-important-bg); border-color: var(--callout-important-border); color: var(--callout-important-text); }

    /* ── Mermaid ── */
    .mermaid {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1rem;
      text-align: center;
      overflow-x: auto;
    }

    /* ── Horizontal rule ── */
    .doc-section hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 1.5rem 0;
    }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--muted); }
  </style>
</head>
<body>
  <nav id="sidebar">
    <div class="sidebar-header">
      <div class="logo">AutoSpec</div>
      <div class="project-name">${escapeHtml(projectName)}</div>
    </div>
    <div class="nav-section-label">Documentation</div>
    ${navItems}
  </nav>

  <main>
    <header>
      <span class="header-title">${escapeHtml(projectName)}</span>
      <span class="generated-at">Generated ${escapeHtml(formattedDate)}</span>
      <button id="theme-toggle">Light mode</button>
    </header>

    <div id="content">
      ${contentSections}
    </div>
  </main>

  <script>
    (function () {
      const STORAGE_THEME = 'autospec-theme';
      const STORAGE_DOC   = 'autospec-active-doc';

      const html    = document.documentElement;
      const toggle  = document.getElementById('theme-toggle');
      const content = document.getElementById('content');

      // ── Theme ──
      const savedTheme = localStorage.getItem(STORAGE_THEME) || 'dark';
      applyTheme(savedTheme);

      toggle.addEventListener('click', () => {
        const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        localStorage.setItem(STORAGE_THEME, next);
        reinitMermaid();
      });

      function applyTheme(theme) {
        html.dataset.theme = theme;
        toggle.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
      }

      // ── Navigation ──
      const navItems  = Array.from(document.querySelectorAll('.nav-item'));
      const sections  = Array.from(document.querySelectorAll('.doc-section'));

      const savedDoc = localStorage.getItem(STORAGE_DOC);
      const initialDoc = savedDoc && document.getElementById('doc-' + savedDoc)
        ? savedDoc
        : (navItems[0] ? navItems[0].dataset.doc : null);

      if (initialDoc) showDoc(initialDoc);

      navItems.forEach((btn) => {
        btn.addEventListener('click', () => {
          showDoc(btn.dataset.doc);
          localStorage.setItem(STORAGE_DOC, btn.dataset.doc);
        });
      });

      function showDoc(id) {
        sections.forEach((s) => s.classList.remove('active'));
        navItems.forEach((b) => b.classList.remove('active'));
        const section = document.getElementById('doc-' + id);
        const btn     = navItems.find((b) => b.dataset.doc === id);
        if (section) section.classList.add('active');
        if (btn)     btn.classList.add('active');
        content.scrollTop = 0;
      }

      // ── Mermaid ──
      const currentTheme = () => html.dataset.theme === 'dark' ? 'dark' : 'default';

      mermaid.initialize({ startOnLoad: false, theme: currentTheme() });

      function reinitMermaid() {
        const diagrams = document.querySelectorAll('.mermaid[data-processed]');
        diagrams.forEach((el) => {
          const src = el.getAttribute('data-src');
          if (src) {
            el.removeAttribute('data-processed');
            el.innerHTML = src;
          }
        });
        mermaid.initialize({ startOnLoad: false, theme: currentTheme() });
        mermaid.run({ querySelector: '.mermaid' });
      }

      // Store original source before mermaid processes it
      document.querySelectorAll('.mermaid').forEach((el) => {
        el.setAttribute('data-src', el.textContent);
      });

      mermaid.run({ querySelector: '.mermaid' });
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
