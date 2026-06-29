import { getProjects, getAllTasks, type Task } from "@/lib/vault";
import { lastCommitIsoMap } from "@/lib/git";
import { buildHaystack } from "@/lib/search";
import { fmtTicket } from "@/lib/ui";
import { effectiveGrade } from "@/lib/grade";
import KanbanFilterBar, { type KanbanTask } from "@/components/KanbanFilterBar";
import { resolveActiveBed } from "@/lib/activeBed";

export const dynamic = "force-dynamic";

export default async function KanbanPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; bed?: string }>;
}) {
  const { project: initialProject = "", bed } = await searchParams;
  const activeBed = await resolveActiveBed(bed);
  const projects = getProjects(activeBed.projectsDir);
  const allTasks = getAllTasks(activeBed.projectsDir);

  // время последнего коммита по каждому файлу задачи — для честной сортировки «Готово»
  const commitIso = lastCommitIsoMap();
  const recency = (t: Task) => commitIso.get(t.file) ?? t.updated;

  // дневные числа (по всем задачам, без учёта фильтра — серверное)
  const today = new Date().toISOString().slice(0, 10);
  const todayCreated = allTasks.filter((t) => t.created === today).length;
  const todayDone = allTasks.filter(
    (t) => t.status === "done" && t.updated === today
  ).length;

  // Подготовить задачи для клиентского компонента
  const kanbanTasks: KanbanTask[] = allTasks.map((t) => ({
    id: t.id,
    slug: t.slug,
    key: t.key,
    project: t.project,
    status: t.status,
    summary: t.summary,
    title: t.title,
    rice: t.rice,
    isBug: t.isBug,
    nextUp: t.nextUp,
    modelTier: t.modelTier,
    displayTier: effectiveGrade(t),
    haystack: buildHaystack({
      id: t.id,
      summary: t.summary,
      title: t.title,
      project: t.project,
      status: t.status,
      tags: t.tags,
      body: t.body,
    }),
    recency: recency(t),
  }));

  const projectSlugs = projects.map((p) => p.slug);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Канбан</h1>
      <KanbanFilterBar
        tasks={kanbanTasks}
        projects={projectSlugs}
        initialProject={initialProject}
        todayCreated={todayCreated}
        todayDone={todayDone}
      />
    </div>
  );
}
