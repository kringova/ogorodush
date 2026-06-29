import Link from "next/link";
import { getProjects, getProject, getRoadmap } from "@/lib/vault";
import { GanttChart, GanttLegend } from "@/components/GanttChart";
import Badge from "@/components/Badge";
import { resolveActiveBed } from "@/lib/activeBed";

export const dynamic = "force-dynamic";

export default async function RoadmapPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; bed?: string }>;
}) {
  const { project: q, bed } = await searchParams;
  const activeBed = await resolveActiveBed(bed);
  const projects = getProjects(activeBed.projectsDir);
  const slug = q && projects.some((p) => p.slug === q) ? q : projects[0]?.slug;
  const project = slug ? getProject(slug, activeBed.projectsDir) : null;
  const roadmap = slug ? getRoadmap(slug, activeBed.projectsDir) : [];

  // doing — активны сейчас, ставим в начало (стартуют сегодня); затем todo по RICE
  const open = (project?.tasks ?? [])
    .filter((t) => t.status === "todo" || t.status === "doing")
    .sort(
      (a, b) =>
        (a.status === "doing" ? 0 : 1) - (b.status === "doing" ? 0 : 1) ||
        (b.rice ?? 0) - (a.rice ?? 0)
    );
  const totalSp = open.reduce((s, t) => s + (t.sp ?? 0), 0);
  const spCount = open.filter((t) => t.sp != null).length;

  const doneAll = (project?.tasks ?? []).filter(
    (t) => t.status === "done" && t.updated
  );
  // показываем последние закрытые, чтобы не раздувать список
  const done = [...doneAll]
    .sort((a, b) => b.updated.localeCompare(a.updated))
    .slice(0, 15);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Роадмап</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Прогноз по приоритету (RICE): бары встык от сегодня, ширина —
        пропорционально оценке задачи (SP). Слева от линии «сегодня» — зелёным уже
        закрытые задачи (по дате закрытия). Не план с фиксированными датами, а
        «при текущих приоритетах доедет к…».
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {projects.map((p) => (
          <Link
            key={p.slug}
            href={`/roadmap?project=${p.slug}`}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              slug === p.slug
                ? "bg-neutral-900 text-white"
                : "bg-white text-neutral-600 ring-1 ring-inset ring-neutral-200 hover:bg-neutral-100"
            }`}
          >
            {p.slug}
          </Link>
        ))}
      </div>

      {project && (
        <>
          <div className="mt-6 flex items-center gap-3">
            <h2 className="text-lg font-semibold">{project.slug}</h2>
            <span className="text-sm text-neutral-400">
              {open.length} задач · {totalSp} SP
              {spCount < open.length && ` (у ${spCount} из ${open.length})`}
            </span>
            <Link
              href={`/projects/${project.slug}`}
              className="text-sm text-[color:var(--color-accent)] hover:underline"
            >
              карточка →
            </Link>
          </div>

          <div className="mt-3">
            <GanttChart open={open} done={done} />
            <GanttLegend />
            {doneAll.length > done.length && (
              <p className="mt-1 text-xs text-neutral-400">
                показаны последние {done.length} из {doneAll.length} закрытых
              </p>
            )}
          </div>

          {/* текстовый роадмап из roadmap.md */}
          {roadmap.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
                План по фазам
              </h3>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {roadmap.map((ph, i) => {
                  const donePh = ph.items.filter((it) => it.done).length;
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold text-neutral-800">
                          {ph.title}
                        </h4>
                        {ph.items.length > 0 && (
                          <Badge className="bg-neutral-100 text-neutral-500 ring-neutral-200">
                            {donePh}/{ph.items.length}
                          </Badge>
                        )}
                      </div>
                      {ph.goal && (
                        <p className="mt-1 text-xs text-neutral-500">
                          {ph.goal}
                        </p>
                      )}
                      <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                        {ph.items.map((it, j) => (
                          <li
                            key={j}
                            className={`flex items-start gap-2 ${
                              it.done
                                ? "text-neutral-400 line-through"
                                : "text-neutral-700"
                            }`}
                          >
                            <span
                              className={
                                it.done
                                  ? "text-emerald-500"
                                  : "text-neutral-300"
                              }
                            >
                              {it.done ? "✓" : "○"}
                            </span>
                            <span>{it.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
