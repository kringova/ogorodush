#!/usr/bin/env node
// Локальный дашборд taskvault. Без зависимостей: читает markdown-vault и отдаёт веб-страницу.
// Запуск из корня vault:  node dashboard/serve.js  [--port 4321] [--open]
// Дашборд читает файлы при каждом запросе, так что правки агента видны по F5.

import { createServer } from "node:http";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const portArg = args.indexOf("--port");
const PORT = portArg !== -1 ? Number(args[portArg + 1]) : 4321;
const rootArg = args.indexOf("--root");
const ROOT = rootArg !== -1 ? resolve(args[rootArg + 1]) : resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OPEN = args.includes("--open");

// ── Парсер YAML-frontmatter (плоский, под наши поля) ──
function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split("\n")) {
    const mm = line.match(/^([A-Za-z_][\w]*):\s*(.*)$/);
    if (!mm) continue;
    let [, key, val] = mm;
    val = val.trim();
    if (val === "") { data[key] = ""; continue; }
    // [a, b] → массив
    if (val.startsWith("[") && val.endsWith("]")) {
      data[key] = val.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      continue;
    }
    val = val.replace(/^["']|["']$/g, "");
    const num = Number(val);
    data[key] = val !== "" && !Number.isNaN(num) && /^-?\d+(\.\d+)?$/.test(val) ? num : val;
  }
  return { data, body: text.slice(m[0].length) };
}

const rice = (t) => {
  const { rice_reach: r, rice_impact: i, rice_confidence: c, rice_effort: e } = t;
  if (![r, i, c, e].every((x) => typeof x === "number") || !e) return null;
  return (r * i * (c / 100)) / e;
};

// ── Сканер vault ──
function scan() {
  const projectsDir = join(ROOT, "projects");
  const projects = [];
  const tasks = [];
  if (existsSync(projectsDir)) {
    for (const slug of readdirSync(projectsDir)) {
      const pdir = join(projectsDir, slug);
      if (!statSync(pdir).isDirectory()) continue;
      const card = join(pdir, `${slug}.md`);
      if (existsSync(card)) {
        const { data } = parseFrontmatter(readFileSync(card, "utf8"));
        if ((data.tags || []).includes("project")) projects.push({ slug, ...data });
      }
      const tdir = join(pdir, "tasks");
      if (existsSync(tdir)) {
        for (const f of readdirSync(tdir)) {
          if (!f.endsWith(".md") || f === "tasks.md") continue;
          const { data } = parseFrontmatter(readFileSync(join(tdir, f), "utf8"));
          if (!(data.tags || []).includes("task")) continue;
          tasks.push({ project: slug, file: f.replace(/\.md$/, ""), ...data, _rice: rice(data) });
        }
      }
    }
  }
  // инбокс
  const inbox = [];
  const idir = join(ROOT, "_inbox");
  if (existsSync(idir)) {
    for (const f of readdirSync(idir)) {
      if (!f.endsWith(".md")) continue;
      const { data, body } = parseFrontmatter(readFileSync(join(idir, f), "utf8"));
      inbox.push({ file: f, created: data.created || "", project: data.project || "", text: body.trim() });
    }
  }
  return { projects, tasks, inbox };
}

// ── Рендер ──
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtRice = (v) => (v == null ? "—" : v.toFixed(1));
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const STATUS_LABEL = { todo: "Todo", doing: "В работе", done: "Готово", blocked: "Блок", cancelled: "Отменено", idea: "Идея", active: "Активен", paused: "Пауза" };
const STATUS_CLASS = { todo: "s-todo", doing: "s-doing", done: "s-done", blocked: "s-blocked", cancelled: "s-cancel", idea: "s-idea", active: "s-active", paused: "s-paused" };

function render({ projects, tasks, inbox }) {
  projects.sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9));
  const active = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const byRice = [...active].sort((a, b) => (b._rice ?? -1) - (a._rice ?? -1));
  const cols = {
    todo: byRice.filter((t) => t.status === "todo"),
    doing: active.filter((t) => t.status === "doing"),
    blocked: active.filter((t) => t.status === "blocked"),
    done: tasks.filter((t) => t.status === "done").sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, 12),
  };
  const totalActive = active.length;

  const projectRows = projects.map((p) => {
    const pt = active.filter((t) => t.project === p.slug);
    const top = pt.sort((a, b) => (b._rice ?? -1) - (a._rice ?? -1))[0];
    return `<tr>
      <td class="pname">${esc(p.slug)}</td>
      <td><span class="badge ${STATUS_CLASS[p.status] || ""}">${esc(STATUS_LABEL[p.status] || p.status || "")}</span></td>
      <td><span class="pri pri-${esc(p.priority)}">${esc(p.priority || "")}</span></td>
      <td class="muted">${esc(p.audience || "")}</td>
      <td class="num">${pt.length}</td>
      <td class="muted">${top ? `${esc(top.summary || top.file)} <span class="ricepill">${fmtRice(top._rice)}</span>` : "—"}</td>
    </tr>`;
  }).join("");

  const riceRows = byRice.slice(0, 40).map((t, i) => `<tr>
      <td class="num muted">${i + 1}</td>
      <td class="ricecell">${fmtRice(t._rice)}</td>
      <td class="pname">${esc(t.project)}</td>
      <td>${esc(t.summary || t.file)}</td>
      <td><span class="badge ${STATUS_CLASS[t.status] || ""}">${esc(STATUS_LABEL[t.status] || t.status)}</span></td>
      <td class="num muted">${t.id != null ? "#" + esc(t.id) : ""}</td>
    </tr>`).join("");

  const card = (t) => `<div class="kc">
      <div class="kc-top"><span class="ricepill">${fmtRice(t._rice)}</span><span class="kc-proj">${esc(t.project)}</span>${t.id != null ? `<span class="kc-id">#${esc(t.id)}</span>` : ""}</div>
      <div class="kc-sum">${esc(t.summary || t.file)}</div>
    </div>`;
  const kanban = (key, title, accent) => `<div class="kcol">
      <div class="kcol-h"><span class="dot ${accent}"></span>${title}<span class="kcount">${cols[key].length}</span></div>
      ${cols[key].map(card).join("") || '<div class="kempty">пусто</div>'}
    </div>`;

  const inboxBlock = inbox.length ? `<section class="block">
      <h2>Инбокс <span class="hcount">${inbox.length}</span></h2>
      <div class="inbox">${inbox.map((e) => `<div class="ie"><div class="ie-meta">${esc(e.created.slice(0, 16).replace("T", " "))}${e.project ? " · " + esc(e.project) : ""}</div><div>${esc(e.text)}</div></div>`).join("")}</div>
      <p class="hint">Разобрать: скажите агенту «разбери инбокс» (навык inbox).</p>
    </section>` : "";

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>taskvault — дашборд</title>
<style>
  :root { --bg:#f6f7f9; --card:#fff; --line:#eceef1; --ink:#1a1d21; --muted:#8b93a1; --blue:#3b82f6; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  .wrap { max-width:1180px; margin:0 auto; padding:28px 20px 60px; }
  header { display:flex; align-items:baseline; justify-content:space-between; gap:16px; margin-bottom:8px; }
  h1 { font-size:22px; margin:0; }
  h1 small { color:var(--muted); font-weight:400; font-size:13px; margin-left:8px; }
  .stats { color:var(--muted); font-size:13px; }
  .block { background:var(--card); border-radius:16px; box-shadow:0 1px 2px rgba(0,0,0,.04); padding:18px 20px; margin-top:18px; }
  h2 { font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); margin:0 0 12px; }
  .hcount { background:#eef1f4; color:var(--muted); border-radius:999px; padding:1px 8px; font-size:11px; margin-left:6px; }
  table { width:100%; border-collapse:collapse; }
  th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.03em; color:var(--muted); font-weight:600; padding:0 10px 8px; }
  td { padding:8px 10px; border-top:1px solid var(--line); vertical-align:top; }
  .pname { font-weight:600; }
  .muted { color:var(--muted); }
  .num { text-align:right; font-variant-numeric:tabular-nums; }
  .ricecell, .ricepill { font-variant-numeric:tabular-nums; font-weight:700; }
  .ricecell { color:var(--blue); }
  .ricepill { background:#eaf1fe; color:var(--blue); border-radius:6px; padding:1px 7px; font-size:12px; }
  .badge { font-size:11px; padding:2px 8px; border-radius:999px; background:#eef1f4; color:#566; }
  .s-doing { background:#fef3c7; color:#92600a; } .s-done { background:#dcfce7; color:#15803d; }
  .s-blocked { background:#fee2e2; color:#b91c1c; } .s-todo { background:#eef1f4; color:#566; }
  .s-active { background:#dbeafe; color:#1d4ed8; } .s-idea { background:#f3e8ff; color:#7c3aed; }
  .pri-high { color:#dc2626; font-weight:600; } .pri-medium { color:#d97706; } .pri-low { color:var(--muted); }
  .kanban { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
  .kcol-h { display:flex; align-items:center; gap:7px; font-size:12px; font-weight:600; color:#566; margin-bottom:10px; }
  .kcount { margin-left:auto; color:var(--muted); font-weight:400; }
  .dot { width:8px; height:8px; border-radius:50%; } .b-todo{background:#9aa4b2}.b-doing{background:#f59e0b}.b-blocked{background:#ef4444}.b-done{background:#22c55e}
  .kc { background:#fafbfc; border:1px solid var(--line); border-radius:10px; padding:9px 10px; margin-bottom:8px; }
  .kc-top { display:flex; align-items:center; gap:6px; margin-bottom:5px; }
  .kc-proj { font-size:11px; color:var(--muted); } .kc-id { margin-left:auto; font-size:11px; color:#c2c8d0; }
  .kc-sum { font-size:13px; }
  .kempty { color:#c2c8d0; font-size:12px; padding:6px 2px; }
  .inbox { display:grid; gap:8px; } .ie { background:#fafbfc; border:1px solid var(--line); border-radius:10px; padding:9px 11px; }
  .ie-meta { font-size:11px; color:var(--muted); margin-bottom:3px; }
  .hint { color:var(--muted); font-size:12px; margin:10px 0 0; }
  @media (max-width:860px){ .kanban{grid-template-columns:1fr 1fr} }
  @media (max-width:560px){ .kanban{grid-template-columns:1fr} }
</style></head><body><div class="wrap">
  <header>
    <h1>taskvault<small>локальный дашборд</small></h1>
    <div class="stats">${projects.length} проектов · ${totalActive} активных задач${inbox.length ? ` · инбокс ${inbox.length}` : ""}</div>
  </header>

  <section class="block"><h2>Проекты</h2>
    <table><thead><tr><th>Проект</th><th>Статус</th><th>Приоритет</th><th>Аудитория</th><th class="num">Задач</th><th>Топ-задача</th></tr></thead>
    <tbody>${projectRows || '<tr><td colspan="6" class="muted">Проектов пока нет — заведите первый.</td></tr>'}</tbody></table>
  </section>

  <section class="block"><h2>Канбан</h2>
    <div class="kanban">
      ${kanban("todo", "Todo", "b-todo")}
      ${kanban("doing", "В работе", "b-doing")}
      ${kanban("blocked", "Блок", "b-blocked")}
      ${kanban("done", "Готово", "b-done")}
    </div>
  </section>

  <section class="block"><h2>Беклог по RICE</h2>
    <table><thead><tr><th class="num">#</th><th>RICE</th><th>Проект</th><th>Задача</th><th>Статус</th><th class="num">id</th></tr></thead>
    <tbody>${riceRows || '<tr><td colspan="6" class="muted">Активных задач нет.</td></tr>'}</tbody></table>
  </section>

  ${inboxBlock}

  <p class="hint">Обновляется автоматически каждые 5 c. Правки агента видны сразу — данные читаются из markdown при каждом запросе.</p>
</div>
<script>setTimeout(()=>location.reload(),5000)</script>
</body></html>`;
}

// ── Сервер ──
const server = createServer((req, res) => {
  try {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(render(scan()));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Ошибка чтения vault: " + e.message);
  }
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  taskvault дашборд → ${url}\n  vault: ${ROOT}\n  Ctrl+C для остановки\n`);
  if (OPEN) {
    const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    spawn(cmd, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).unref();
  }
});
