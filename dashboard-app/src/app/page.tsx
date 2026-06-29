import Link from "next/link";
import { getProjects, topTask, type Project } from "@/lib/vault";
import {
  STATUS_LABEL,
  STATUS_CLASS,
  PRIORITY_LABEL,
  PRIORITY_CLASS,
  fmtRice,
} from "@/lib/ui";
import Badge from "@/components/Badge";
import { resolveActiveBed } from "@/lib/activeBed";

export const dynamic = "force-dynamic";

/** Цвет прогресс-бара по проценту готовности. */
function progressColor(pct: number): string {
  if (pct === 0) return "bg-neutral-300";
  if (pct < 34) return "bg-rose-400";
  if (pct < 67) return "bg-amber-400";
  if (pct < 100) return "bg-lime-500";
  return "bg-emerald-500";
}

function ProjectCard({ p }: { p: Project }) {
  const top = topTask(p);
  const openCount = p.tasks.filter(
    (t) => t.status === "todo" || t.status === "doing"
  ).length;
  const doneCount = p.tasks.filter((t) => t.status === "done").length;
  const considered = p.tasks.filter((t) => t.status !== "cancelled").length;
  const pct = considered ? Math.round((doneCount / considered) * 100) : 0;

  return (
    <Link
      href={`/projects/${p.slug}`}
      className="group flex flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold text-neutral-900 group-hover:text-[color:var(--color-accent)]">
          {p.slug}
        </h2>
        <Badge className={STATUS_CLASS[p.status] ?? STATUS_CLASS.idea}>
          {STATUS_LABEL[p.status] ?? p.status}
        </Badge>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge className={PRIORITY_CLASS[p.priority] ?? PRIORITY_CLASS.medium}>
          {PRIORITY_LABEL[p.priority] ?? p.priority}
        </Badge>
        {p.type && (
          <Badge className="bg-neutral-100 text-neutral-500 ring-neutral-200">
            {p.type}
          </Badge>
        )}
      </div>

      {p.audience && (
        <p className="mt-3 line-clamp-2 text-sm text-neutral-500">
          {p.audience}
        </p>
      )}
      {p.jtbd && (
        <p className="mt-1 line-clamp-1 text-xs italic text-neutral-400">
          {p.jtbd}
        </p>
      )}

      <div className="mt-4 border-t border-neutral-100 pt-3 text-sm">
        {top ? (
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-neutral-600">
              <span className="text-neutral-400">Топ:</span>{" "}
              {top.summary || top.title}
            </span>
            <span className="shrink-0 font-mono text-xs text-[color:var(--color-accent)]">
              {fmtRice(top.rice)}
            </span>
          </div>
        ) : (
          <span className="text-neutral-400">нет открытых задач</span>
        )}
      </div>

      {/* прогресс по задачам */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-neutral-400">
          <span>
            {doneCount}/{considered} готово · {openCount} открытых
          </span>
          <span className="font-medium text-neutral-500">{pct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full rounded-full transition-all ${progressColor(pct)}`}
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        </div>
        {p.phases.total > 0 && (
          <div className="mt-1 text-xs text-neutral-400">
            фазы: {p.phases.done}/{p.phases.total}
          </div>
        )}
      </div>

      {(p.updated || p.lastCommit) && (
        <div className="mt-2 flex items-center justify-between text-xs text-neutral-400">
          {p.lastCommit ? (
            <span title="последний коммит, затронувший проект">
              ⎇ {p.lastCommit}
            </span>
          ) : (
            <span />
          )}
          {p.updated && (
            <span title="поле updated в карточке">обновлён {p.updated}</span>
          )}
        </div>
      )}
    </Link>
  );
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ bed?: string }>;
}) {
  const sp = await searchParams;
  const activeBed = await resolveActiveBed(sp.bed);
  const projects = getProjects(activeBed.projectsDir);
  const active = projects.filter((p) => p.status === "active");
  // прочие: на паузе / идеи — выше, готовые — в конец
  const otherRank = (s: string) => (s === "done" ? 2 : s === "idea" ? 1 : 0);
  const others = projects
    .filter((p) => p.status !== "active")
    .sort((a, b) => otherRank(a.status) - otherRank(b.status));

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Проекты</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {projects.length} проектов из vault
          </p>
        </div>
      </div>

      {active.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Активные · {active.length}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((p) => (
              <ProjectCard key={p.slug} p={p} />
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            <span className="inline-block h-2 w-2 rounded-full bg-neutral-300" />
            Остальные · {others.length}{" "}
            <span className="font-normal normal-case text-neutral-300">
              готовы · пауза · идеи
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-4 opacity-90 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((p) => (
              <ProjectCard key={p.slug} p={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
