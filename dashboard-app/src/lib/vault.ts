import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { cache } from "react";
import matter from "gray-matter";
import { IDEAL_DAYS_PER_PERSON_WEEK } from "./config";

/** Корень vault. На VPS — путь к клону репо, локально — папка vault. */
export const VAULT_PATH =
  process.env.VAULT_PATH || process.cwd();

const PROJECTS_DIR = path.join(VAULT_PATH, "projects");
const INBOX_DIR = path.join(VAULT_PATH, "_inbox");

/** Дата последнего коммита, затронувшего путь внутри vault (YYYY-MM-DD) или "". */
function lastCommitDateForPath(relPath: string): string {
  try {
    return execFileSync(
      "git",
      ["-C", VAULT_PATH, "log", "-1", "--format=%ad", "--date=short", "--", relPath],
      { stdio: ["ignore", "pipe", "ignore"] }
    )
      .toString()
      .trim();
  } catch {
    return "";
  }
}

export type TaskStatus = "todo" | "doing" | "review" | "blocked" | "done" | "cancelled";

export interface Task {
  id: number; // номер тикета → ARTEL-####
  slug: string; // имя md-файла (для wiki-ссылок и обратной совместимости URL)
  key: string; // ключ тикета ARTEL-#### (основной идентификатор в URL); = slug, если id нет
  project: string; // slug проекта (имя папки)
  status: TaskStatus;
  title: string; // человекочитаемое имя из slug
  summary: string;
  tags: string[];
  isBug: boolean;
  /** помечена «взять в работу следующей» (next up) */
  nextUp: boolean;
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  /** оценка в идеальных днях (из est_days; иначе из rice_effort × 5) */
  estDays: number;
  /** Story Points — размер задачи (Фибоначчи); null у старых задач (только est_days) */
  sp: number | null;
  /** грейд модели junior/middle/senior; null если не проставлен */
  modelTier: string | null;
  /** факт io-токенов по задаче (сумма по моделям); 0 если не считалось */
  costIoTokens: number;
  /** разбивка токенов по моделям: "model=io/cache; ..." */
  costByModel: string;
  /** RICE = (reach × impact × confidence%) / effort. null для done/cancelled. */
  rice: number | null;
  created: string;
  updated: string;
  /** ISO-метка создания (точное время, если задано); fallback на created */
  createdAt: string;
  /** ISO-метка закрытия (у done/cancelled); пусто у открытых */
  closedAt: string;
  /** путь к md-файлу относительно VAULT_PATH (для git-дат) */
  file: string;
  body: string;
}

export interface Project {
  slug: string;
  title: string;
  status: string;
  type: string;
  priority: string;
  audience: string;
  repo: string;
  local: string;
  tags: string[];
  updated: string;
  lastCommit: string; // дата последнего коммита, затронувшего папку проекта (YYYY-MM-DD)
  body: string;
  tasks: Task[];
  jtbd: string;
  phases: { done: number; total: number };
  docs: { brief: boolean; roadmap: boolean; decisions: boolean; scenarios: boolean };
}

export interface InboxItem {
  slug: string;
  project: string | null;
  text: string;
  created: string;
}

function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function asString(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (v == null || v === "") return [];
  return [String(v)];
}

function asNum(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

/** "csv-export" → "Csv export" — мягкое очеловечивание slug. */
function humanize(slug: string): string {
  const s = slug.replace(/-/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function computeRice(t: {
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  status: TaskStatus;
}): number | null {
  if (t.status === "done" || t.status === "cancelled") return null;
  if (!t.effort) return null;
  return (t.reach * t.impact * (t.confidence / 100)) / t.effort;
}

function readTask(projectSlug: string, filePath: string): Task | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
  const { data, content } = matter(raw);
  const slug = path.basename(filePath, ".md");
  const tags = asArray(data.tags);
  const status = (asString(data.status) || "todo") as TaskStatus;
  const reach = asNum(data.rice_reach);
  const impact = asNum(data.rice_impact);
  const confidence = asNum(data.rice_confidence);
  const effort = asNum(data.rice_effort);
  const id = asNum(data.id);
  return {
    id,
    slug,
    key: id ? `ARTEL-${String(id).padStart(4, "0")}` : slug,
    project: projectSlug,
    status,
    title: humanize(slug),
    summary: asString(data.summary),
    tags,
    isBug: tags.includes("bug"),
    nextUp: data.next_up === true,
    reach,
    impact,
    confidence,
    effort,
    estDays:
      data.est_days != null
        ? asNum(data.est_days)
        : effort * IDEAL_DAYS_PER_PERSON_WEEK,
    sp: data.sp != null ? asNum(data.sp) : null,
    modelTier: asString(data.model_tier) || null,
    costIoTokens: asNum(data.cost_io_tokens),
    costByModel: asString(data.cost_by_model),
    rice: computeRice({ reach, impact, confidence, effort, status }),
    created: asString(data.created),
    updated: asString(data.updated),
    createdAt: asString(data.created_at) || asString(data.created),
    closedAt: asString(data.closed_at),
    file: path.relative(VAULT_PATH, filePath),
    body: content.trim(),
  };
}

function readProjectTasks(projectDir: string, projectSlug: string): Task[] {
  const tasksDir = path.join(projectDir, "tasks");
  if (!isDir(tasksDir)) return [];
  const tasks: Task[] = [];
  for (const f of fs.readdirSync(tasksDir)) {
    if (!f.endsWith(".md") || f === "tasks.md") continue;
    const t = readTask(projectSlug, path.join(tasksDir, f));
    if (t) tasks.push(t);
  }
  return tasks;
}

/** Найти файл-карточку проекта: предпочесть <slug>.md, иначе первый .md с тегом project. */
function findProjectCard(projectDir: string, slug: string): string | null {
  const preferred = path.join(projectDir, `${slug}.md`);
  if (fs.existsSync(preferred)) return preferred;
  for (const f of fs.readdirSync(projectDir)) {
    if (!f.endsWith(".md")) continue;
    const full = path.join(projectDir, f);
    try {
      const { data } = matter(fs.readFileSync(full, "utf8"));
      if (asArray(data.tags).includes("project")) return full;
    } catch {
      /* skip */
    }
  }
  return null;
}

/**
 * Per-request memoised version of the raw vault reader.
 * React cache() deduplicates calls within a single server render pass —
 * if multiple route segments or lib functions call getProjects() on the same
 * request they all share one result. Cache is automatically cleared between
 * requests (React's request-scoped cache semantics).
 */
export const getProjects: (projectsDir?: string) => Project[] = cache(
  function _getProjects(projectsDir: string = PROJECTS_DIR) {
  if (!isDir(projectsDir)) return [];
  const projects: Project[] = [];
  for (const slug of fs.readdirSync(projectsDir)) {
    const projectDir = path.join(projectsDir, slug);
    if (!isDir(projectDir)) continue;
    const card = findProjectCard(projectDir, slug);
    if (!card) continue;
    const { data, content } = matter(fs.readFileSync(card, "utf8"));
    projects.push({
      slug,
      title: humanize(slug),
      status: asString(data.status) || "idea",
      type: asString(data.type),
      priority: asString(data.priority) || "medium",
      audience: asString(data.audience),
      repo: asString(data.repo),
      local: asString(data.local),
      tags: asArray(data.tags),
      updated: asString(data.updated),
      lastCommit: lastCommitDateForPath(path.relative(VAULT_PATH, projectDir)),
      body: content.trim(),
      tasks: readProjectTasks(projectDir, slug),
      jtbd: asString(data.jtbd),
      phases: phaseProgress(slug, projectsDir),
      docs: projectDocs(slug, projectsDir),
    });
  }
  // активные проекты выше, затем по приоритету, затем по дате обновления
  const prio: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return projects.sort(
    (a, b) =>
      (prio[a.priority] ?? 1) - (prio[b.priority] ?? 1) ||
      b.updated.localeCompare(a.updated)
  );
});

export function getProject(slug: string, projectsDir: string = PROJECTS_DIR): Project | null {
  return getProjects(projectsDir).find((p) => p.slug === slug) ?? null;
}

export function getTask(projectSlug: string, taskKey: string, projectsDir: string = PROJECTS_DIR): Task | null {
  // Резолвим по ключу ARTEL-#### (основной URL) или по slug (старые wiki-ссылки).
  const tasks = getProject(projectSlug, projectsDir)?.tasks;
  return tasks?.find((t) => t.key === taskKey || t.slug === taskKey) ?? null;
}

export function getTaskById(id: number, projectsDir: string = PROJECTS_DIR): Task | null {
  return getAllTasks(projectsDir).find((t) => t.id === id) ?? null;
}

export interface RoadmapPhase {
  title: string;
  goal: string;
  items: { text: string; done: boolean }[];
}

/** Парсинг roadmap.md проекта в фазы. */
export function getRoadmap(projectSlug: string, projectsDir: string = PROJECTS_DIR): RoadmapPhase[] {
  const file = path.join(projectsDir, projectSlug, "roadmap.md");
  if (!fs.existsSync(file)) return [];
  const { content } = matter(fs.readFileSync(file, "utf8"));
  const phases: RoadmapPhase[] = [];
  let cur: RoadmapPhase | null = null;
  for (const line of content.split("\n")) {
    const h = line.match(/^##\s+(.*)$/);
    if (h) {
      if (cur) phases.push(cur);
      cur = { title: h[1].trim(), goal: "", items: [] };
      continue;
    }
    if (!cur) continue;
    const goal = line.match(/^\*\*Цель:\*\*\s*(.*)$/);
    if (goal) cur.goal = goal[1].trim();
    const item = line.match(/^\s*-\s*\[([ xX])\]\s*(.*)$/);
    if (item) cur.items.push({ text: item[2].trim(), done: item[1].toLowerCase() === "x" });
  }
  if (cur) phases.push(cur);
  return phases;
}

/** Прогресс по фазам: завершённая фаза = есть пункты и все отмечены. */
function phaseProgress(slug: string, projectsDir: string = PROJECTS_DIR): { done: number; total: number } {
  const phases = getRoadmap(slug, projectsDir).filter((p) => p.items.length > 0);
  const done = phases.filter((p) => p.items.every((i) => i.done)).length;
  return { done, total: phases.length };
}

function projectDocs(slug: string, projectsDir: string = PROJECTS_DIR) {
  const has = (name: string) => fs.existsSync(path.join(projectsDir, slug, name));
  return {
    brief: has("brief.md"),
    roadmap: has("roadmap.md"),
    decisions: has("decisions.md"),
    scenarios: has("scenarios.md"),
  };
}

export function readProjectDoc(slug: string, name: string, projectsDir: string = PROJECTS_DIR): string | null {
  const allowed = ["brief", "decisions", "scenarios", "roadmap"];
  if (!allowed.includes(name)) return null;
  const file = path.join(projectsDir, slug, name + ".md");
  if (!fs.existsSync(file)) return null;
  return matter(fs.readFileSync(file, "utf8")).content.trim();
}

export function getAllTasks(projectsDir: string = PROJECTS_DIR): Task[] {
  return getProjects(projectsDir).flatMap((p) => p.tasks);
}

/** Открытые задачи (todo/doing) по убыванию RICE. */
export function getTasksByRice(projectsDir: string = PROJECTS_DIR): Task[] {
  return getAllTasks(projectsDir)
    .filter((t) => t.status === "todo" || t.status === "doing")
    .sort((a, b) => (b.rice ?? 0) - (a.rice ?? 0));
}

/** Топ-задача проекта — открытая с максимальным RICE. */
export function topTask(p: Project): Task | null {
  return (
    p.tasks
      .filter((t) => t.status === "todo" || t.status === "doing")
      .sort((a, b) => (b.rice ?? 0) - (a.rice ?? 0))[0] ?? null
  );
}

export interface BurndownPoint {
  date: string;
  remaining: number;
}

/**
 * Burndown: остаток открытой работы (в Story Points) во времени.
 * События: +SP при создании задачи, −SP при закрытии выполненной.
 * Учитывает даты создания (created/createdAt) и закрытия (closedAt/updated у done).
 */
export function getBurndown(projectSlug?: string, projectsDir: string = PROJECTS_DIR): {
  points: BurndownPoint[];
  openNow: number;
  doneTotal: number;
  total: number;
} {
  const all = projectSlug ? getProject(projectSlug, projectsDir)?.tasks ?? [] : getAllTasks(projectsDir);
  // scope: задачи с проставленным sp, кроме отменённых
  const scope = all.filter((t) => t.sp != null && t.status !== "cancelled");

  // SP сейчас: открытые = всё, что НЕ done (todo/doing/review/blocked); выполнено = done
  const openNow = scope
    .filter((t) => t.status !== "done")
    .reduce((s, t) => s + (t.sp as number), 0);
  const doneTotal = scope
    .filter((t) => t.status === "done")
    .reduce((s, t) => s + (t.sp as number), 0);
  const total = openNow + doneTotal;

  // локальная сегодняшняя дата YYYY-MM-DD (без UTC-сдвига)
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  // события: +sp в дату создания, -sp в дату закрытия (только у done)
  const delta = new Map<string, number>();
  const add = (date: string, d: number) => {
    if (!date) return;
    delta.set(date, (delta.get(date) ?? 0) + d);
  };
  for (const t of scope) {
    const sp = t.sp as number;
    const created = (t.created || t.createdAt || "").slice(0, 10);
    if (!created) continue;
    add(created, sp); // задача появилась в работе
    if (t.status === "done") {
      const closed = (t.closedAt || t.updated || "").slice(0, 10);
      add(closed, -sp); // выполнена → сгорела
    }
  }

  if (delta.size === 0) {
    return { points: [{ date: today, remaining: openNow }], openNow, doneTotal, total };
  }

  // накопить остаток по датам в хронологии
  const dates = [...delta.keys()].sort((a, b) => a.localeCompare(b));
  let running = 0;
  const points: BurndownPoint[] = [];
  for (const d of dates) {
    running += delta.get(d) as number;
    points.push({ date: d, remaining: Math.max(0, running) });
  }
  // продлить плоско до сегодня (последняя точка = текущий остаток = openNow)
  if (points[points.length - 1].date !== today) {
    points.push({ date: today, remaining: Math.max(0, running) });
  }

  return { points, openNow, doneTotal, total };
}


export interface Snapshot {
  date: string;
  measured_tasks: number;
  io_by_grade: { junior: number; middle: number; senior: number; other: number };
  total_io: number;
  pct_junior_io: number;
  total_sp_measured: number;
  tokens_per_sp: number | null;
  done_sp_total?: number;
  done_sp_covered?: number;
  coverage_pct: number | null;
}

export function getSnapshots(): Snapshot[] {
  const file = path.join(VAULT_PATH, "metrics/snapshots.jsonl");
  try {
    const raw = fs.readFileSync(file, "utf8");
    const snapshots: Snapshot[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        snapshots.push(JSON.parse(trimmed) as Snapshot);
      } catch {
        /* skip malformed lines */
      }
    }
    return snapshots.sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

export function getInbox(inboxDir: string = INBOX_DIR): InboxItem[] {
  if (!isDir(inboxDir)) return [];
  const items: InboxItem[] = [];
  for (const f of fs.readdirSync(inboxDir)) {
    if (!f.endsWith(".md")) continue;
    const full = path.join(inboxDir, f);
    const { data, content } = matter(fs.readFileSync(full, "utf8"));
    items.push({
      slug: path.basename(f, ".md"),
      project: data.project ? asString(data.project) : null,
      text: content.trim(),
      created: asString(data.created) || path.basename(f, ".md"),
    });
  }
  return items.sort((a, b) => b.created.localeCompare(a.created));
}
