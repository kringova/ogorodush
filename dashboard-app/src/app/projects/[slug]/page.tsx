import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/vault";
import {
  STATUS_LABEL,
  STATUS_CLASS,
  PRIORITY_LABEL,
  PRIORITY_CLASS,
  fmtRice,
  fmtTicket,
} from "@/lib/ui";
import Badge from "@/components/Badge";
import Md from "@/components/Md";
import { resolveActiveBed } from "@/lib/activeBed";

export const dynamic = "force-dynamic";

const STATUS_ORDER = ["doing", "todo", "done", "cancelled"];

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ bed?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const activeBed = await resolveActiveBed(sp.bed);
  const project = getProject(slug, activeBed.projectsDir);
  if (!project) notFound();

  const tasks = [...project.tasks].sort((a, b) => {
    const so =
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (so !== 0) return so;
    // закрытые/отменённые — по дате (свежезакрытые сверху); открытые — по RICE
    if (a.status === "done" || a.status === "cancelled")
      return b.updated.localeCompare(a.updated);
    return (b.rice ?? 0) - (a.rice ?? 0);
  });

  return (
    <div>
      <Link
        href="/"
        className="text-sm text-neutral-400 hover:text-neutral-600"
      >
        ← Проекты
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{project.slug}</h1>
        <Badge className={STATUS_CLASS[project.status] ?? STATUS_CLASS.idea}>
          {STATUS_LABEL[project.status] ?? project.status}
        </Badge>
        <Badge
          className={PRIORITY_CLASS[project.priority] ?? PRIORITY_CLASS.medium}
        >
          {PRIORITY_LABEL[project.priority] ?? project.priority}
        </Badge>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-500">
        {project.audience && <span>{project.audience}</span>}
        {project.repo && (
          <a
            href={project.repo}
            target="_blank"
            rel="noreferrer"
            className="text-[color:var(--color-accent)] hover:underline"
          >
            репозиторий
          </a>
        )}
        {project.lastCommit && (
          <span className="text-neutral-400" title="последний коммит, затронувший проект">
            ⎇ {project.lastCommit}
          </span>
        )}
        {project.updated && (
          <span className="text-neutral-400">обновлён {project.updated}</span>
        )}
      </div>

      {project.jtbd && (
        <p className="mt-1 text-sm italic text-neutral-500">{project.jtbd}</p>
      )}

      {/* Документы проекта */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-neutral-400">Документы:</span>
        {([
          ["brief", "Бриф", project.docs.brief],
          ["roadmap", "Роадмап", project.docs.roadmap],
          ["decisions", "Решения", project.docs.decisions],
          ["scenarios", "Сценарии", project.docs.scenarios],
        ] as const).map(([name, label, present]) =>
          present ? (
            <Link
              key={name}
              href={name === "roadmap" ? `/roadmap?project=${slug}` : `/projects/${slug}/doc/${name}`}
              className="rounded-md bg-neutral-100 px-2 py-0.5 text-[color:var(--color-accent)] ring-1 ring-neutral-200 hover:underline"
            >
              {label}
            </Link>
          ) : (
            <span key={name} className="rounded-md px-2 py-0.5 text-neutral-300" title="нет документа">
              {label} —
            </span>
          )
        )}
        {project.repo && (
          <a
            href={`${project.repo}/blob/main/docs/architecture.md`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-neutral-100 px-2 py-0.5 text-[color:var(--color-accent)] ring-1 ring-neutral-200 hover:underline"
          >
            Архитектура ↗
          </a>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
        <div className="order-2 min-w-0 lg:order-1">
          <Md project={slug}>{project.body}</Md>
        </div>

        <aside className="order-1 lg:order-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Задачи · {tasks.length}
          </h2>
          <div className="flex flex-col gap-2">
            {tasks.map((t) => (
              <Link
                key={t.slug}
                href={`/t/${t.key}`}
                className="block rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition hover:border-neutral-300 hover:shadow"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-neutral-900">
                    {fmtTicket(t.id)}
                  </span>
                  {t.rice != null && (
                    <span className="shrink-0 font-mono text-xs text-[color:var(--color-accent)]">
                      {fmtRice(t.rice)}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[13px] text-neutral-500">
                  {t.summary || t.title}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <Badge className={STATUS_CLASS[t.status]}>
                    {STATUS_LABEL[t.status] ?? t.status}
                  </Badge>
                  {t.isBug && (
                    <Badge className="bg-rose-50 text-rose-600 ring-rose-200">
                      bug
                    </Badge>
                  )}
                </div>
              </Link>
            ))}
            {tasks.length === 0 && (
              <p className="text-sm text-neutral-400">нет задач</p>
            )}
          </div>
        </aside>
      </div>

    </div>
  );
}
