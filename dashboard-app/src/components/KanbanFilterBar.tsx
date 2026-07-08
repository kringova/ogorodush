"use client";

import { useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import { matchesQuery } from "@/lib/search";
import { KANBAN_COLUMNS, STATUS_CLASS, fmtRice, fmtTicket } from "@/lib/ui";
import Badge from "@/components/Badge";
import GradeBadge from "@/components/GradeBadge";

/** Данные задачи, которые приходят от серверного KanbanPage. */
export type KanbanTask = {
  id: number;
  slug: string;
  key: string;
  project: string;
  status: string;
  summary: string;
  title: string;
  rice: number | null;
  isBug: boolean;
  nextUp: boolean;
  modelTier: string | null;
  /** Эффективный грейд: для done-задач — фактический (по токенам), иначе плановый */
  displayTier: string | null;
  haystack: string;
  /** дата последнего действия (для сортировки «Готово») */
  recency: string;
};

type Props = {
  tasks: KanbanTask[];
  projects: string[];
  /** начальный проект из searchParams (серверный) */
  initialProject: string;
  todayCreated: number;
  todayDone: number;
};

const TIER_LABELS: { key: string; label: string }[] = [
  { key: "", label: "Все грейды" },
  { key: "junior", label: "junior" },
  { key: "middle", label: "middle" },
  { key: "senior", label: "senior" },
];

function TaskCard({ t }: { t: KanbanTask }) {
  const [busy, setBusy] = useState(false);
  // «next up» имеет смысл только для todo — у doing/review/done/cancelled не подсвечиваем
  const pinned = t.status === "todo" && t.nextUp;

  async function toggleNextUp(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/next-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: t.key, value: !t.nextUp }),
      });
      if (r.ok) {
        window.location.reload();
      } else {
        setBusy(false);
      }
    } catch {
      setBusy(false);
    }
  }

  return (
    <div
      className={`relative block rounded-lg border bg-white p-3.5 shadow-sm transition hover:shadow-md ${
        pinned
          ? "border-amber-300 ring-2 ring-amber-300/60 hover:border-amber-400"
          : "border-neutral-200 hover:border-neutral-300"
      }`}
    >
      {/* слой-навигация на всю карточку */}
      <Link
        href={`/t/${t.key}`}
        aria-label={fmtTicket(t.id)}
        className="absolute inset-0 z-0 rounded-lg"
      />
      {/* контент не перехватывает клики (pointer-events-none), кроме интерактивных детей */}
      <div className="pointer-events-none relative z-10">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-semibold text-neutral-900">
            {fmtTicket(t.id)}
          </span>
          <div className="flex items-center gap-1.5">
            {t.status === "todo" && (
              <button
                type="button"
                onClick={toggleNextUp}
                disabled={busy}
                title={t.nextUp ? "Снять «next up»" : "Пометить «next up»"}
                aria-label={t.nextUp ? "Снять «next up»" : "Пометить «next up»"}
                className={`pointer-events-auto rounded-md px-1.5 py-0.5 text-xs leading-none transition disabled:opacity-50 ${
                  t.nextUp
                    ? "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-300"
                    : "text-neutral-400 ring-1 ring-inset ring-neutral-200 hover:bg-neutral-100 hover:text-neutral-600"
                }`}
              >
                📌
              </button>
            )}
            {t.rice != null && (
              <span className="shrink-0 font-mono text-xs text-[color:var(--color-accent)]">
                {fmtRice(t.rice)}
              </span>
            )}
          </div>
        </div>
        {pinned && (
          <span className="mt-1.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            📌 next up
          </span>
        )}
        <p className="mt-1.5 line-clamp-3 text-[13px] leading-snug text-neutral-500">
          {t.summary || t.title}
        </p>
        <div className="mt-2.5 flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Badge className="bg-neutral-100 text-neutral-500 ring-neutral-200">
              {t.project}
            </Badge>
            {t.isBug && (
              <Badge className="bg-rose-50 text-rose-600 ring-rose-200">bug</Badge>
            )}
            {t.status === "review" && (
              <Badge className="bg-violet-50 text-violet-700 ring-violet-200">
                ждёт апрува
              </Badge>
            )}
            {t.status === "blocked" && (
              <Badge className="bg-red-100 text-red-700 ring-red-200">
                заблокировано
              </Badge>
            )}
          </div>
          {t.displayTier && <GradeBadge tier={t.displayTier} size="md" />}
        </div>
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-neutral-900 text-white"
          : "bg-white text-neutral-600 ring-1 ring-inset ring-neutral-200 hover:bg-neutral-100"
      }`}
    >
      {label}
    </button>
  );
}

/** Вычислить задачи колонки из отфильтрованного списка. */
function getColTasks(filtered: KanbanTask[], colStatus: string) {
  const all = filtered.filter((t) =>
    colStatus === "todo"
      ? t.status === "todo" || t.status === "blocked"
      : colStatus === "doing"
      ? t.status === "doing" || t.status === "review"
      : t.status === colStatus
  );
  const total = all.length;
  const colTasks =
    colStatus === "done"
      ? [...all]
          .sort((a, b) => b.recency.localeCompare(a.recency))
          .slice(0, 15)
      : [...all].sort(
          (a, b) =>
            Number(b.status === "todo" && b.nextUp) -
              Number(a.status === "todo" && a.nextUp) ||
            (b.rice ?? 0) - (a.rice ?? 0)
        );
  const hidden = total - colTasks.length;
  return { colTasks, total, hidden };
}

export default function KanbanFilterBar({
  tasks,
  projects,
  initialProject,
  todayCreated,
  todayDone,
}: Props) {
  const [q, setQ] = useState("");
  const [project, setProject] = useState(initialProject);
  const [tier, setTier] = useState("");
  // Активная вкладка на мобиле: по умолчанию «В работе»
  const [mobileTab, setMobileTab] = useState<"todo" | "doing" | "done">("doing");

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (project && t.project !== project) return false;
      if (tier && t.displayTier !== tier) return false;
      if (!matchesQuery(t.haystack, q)) return false;
      return true;
    });
  }, [tasks, project, tier, q]);

  const todayDelta: Record<string, { text: string; cls: string } | null> = {
    todo: todayCreated > 0 ? { text: `+${todayCreated} сегодня`, cls: "text-blue-600" } : null,
    done: todayDone > 0 ? { text: `✓${todayDone} сегодня`, cls: "text-emerald-600" } : null,
  };

  // Подсчёт задач в каждой колонке (для табов мобиле)
  const colCounts = useMemo(() => {
    return {
      todo: filtered.filter((t) => t.status === "todo" || t.status === "blocked").length,
      doing: filtered.filter((t) => t.status === "doing" || t.status === "review").length,
      done: filtered.filter((t) => t.status === "done").length,
    };
  }, [filtered]);

  return (
    <div>
      {/* Строка поиска */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            ⌕
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="OGOROD-42, название, тег…"
            className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[color:var(--color-accent)]"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded px-1.5 text-neutral-400 hover:text-neutral-700"
              aria-label="Очистить"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Фильтры: проект и грейд — отдельными строками, чтобы грейд-группа («Все грейды» + J/M/S) держалась цельно */}
      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Chip label="Все" active={!project} onClick={() => setProject("")} />
          {projects.map((p) => (
            <Chip
              key={p}
              label={p}
              active={project === p}
              onClick={() => setProject(project === p ? "" : p)}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {TIER_LABELS.map(({ key, label }) =>
            key === "" ? (
              <Chip
                key="_all"
                label={label}
                active={tier === key}
                onClick={() => setTier(tier === key ? "" : key)}
              />
            ) : (
              <button
                key={key}
                onClick={() => setTier(tier === key ? "" : key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                  tier === key
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-600 ring-1 ring-inset ring-neutral-200 hover:bg-neutral-100"
                }`}
              >
                <GradeBadge tier={key} showLabel />
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Мобильный вид: таб-переключатель статусов (скрыт на lg+) ── */}
      <div className="mt-5 lg:hidden">
        {/* Таб-бар */}
        <div className="flex rounded-xl border border-neutral-200 bg-neutral-100/60 p-1 gap-1">
          {KANBAN_COLUMNS.map((col) => {
            const count = colCounts[col.status as keyof typeof colCounts];
            const isActive = mobileTab === col.status;
            return (
              <button
                key={col.status}
                onClick={() => setMobileTab(col.status as "todo" | "doing" | "done")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition ${
                  isActive
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                <span>{col.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${
                    isActive
                      ? "bg-neutral-100 text-neutral-600"
                      : "text-neutral-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Одна колонка активного таба */}
        {KANBAN_COLUMNS.filter((col) => col.status === mobileTab).map((col) => {
          const { colTasks, total, hidden } = getColTasks(filtered, col.status);
          return (
            <div
              key={col.status}
              className="mt-3 rounded-xl border border-neutral-200 bg-neutral-100/50 p-3"
            >
              <div className="mb-3 flex items-center gap-2 px-1">
                <Badge className={STATUS_CLASS[col.status]}>{col.label}</Badge>
                <span className="text-xs text-neutral-400">{total}</span>
                {todayDelta[col.status] && (
                  <span
                    className={`ml-auto text-xs font-semibold tabular-nums ${todayDelta[col.status]!.cls}`}
                  >
                    {todayDelta[col.status]!.text}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {colTasks.map((t) => (
                  <TaskCard key={`${t.project}/${t.slug}`} t={t} />
                ))}
                {colTasks.length === 0 && (
                  <p className="px-1 py-4 text-center text-xs text-neutral-400">
                    пусто
                  </p>
                )}
                {hidden > 0 && (
                  <p className="px-1 py-1 text-center text-xs text-neutral-400">
                    + ещё {hidden} (показаны 15 свежих)
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Десктопный вид: прежний grid из 3 колонок (только на lg+) ── */}
      <div className="mt-6 hidden lg:mx-[calc(50%-50vw)] lg:block lg:px-8">
        <div className="mx-auto grid max-w-[1200px] gap-5 lg:grid-cols-3">
          {KANBAN_COLUMNS.map((col) => {
            const { colTasks, total, hidden } = getColTasks(filtered, col.status);
            return (
              <div
                key={col.status}
                className="rounded-xl border border-neutral-200 bg-neutral-100/50 p-3"
              >
                <div className="mb-3 flex items-center gap-2 px-1">
                  <Badge className={STATUS_CLASS[col.status]}>{col.label}</Badge>
                  <span className="text-xs text-neutral-400">{total}</span>
                  {todayDelta[col.status] && (
                    <span
                      className={`ml-auto text-xs font-semibold tabular-nums ${todayDelta[col.status]!.cls}`}
                    >
                      {todayDelta[col.status]!.text}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {colTasks.map((t) => (
                    <TaskCard key={`${t.project}/${t.slug}`} t={t} />
                  ))}
                  {colTasks.length === 0 && (
                    <p className="px-1 py-4 text-center text-xs text-neutral-400">
                      пусто
                    </p>
                  )}
                  {hidden > 0 && (
                    <p className="px-1 py-1 text-center text-xs text-neutral-400">
                      + ещё {hidden} (показаны 15 свежих)
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
