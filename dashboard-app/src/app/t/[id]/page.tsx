import { permanentRedirect, notFound } from "next/navigation";
import { getAllTasks, getProject } from "@/lib/vault";
import TaskView from "@/components/TaskView";
import { resolveActiveBed } from "@/lib/activeBed";

export const dynamic = "force-dynamic";

/** Канонический адрес задачи: /t/ARTEL-0042 (или /t/42 → 301 на канон). */
export default async function TaskShortPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bed?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const activeBed = await resolveActiveBed(sp.bed);
  const num = parseInt(id.replace(/\D/g, ""), 10);
  const all = getAllTasks(activeBed.projectsDir);
  // Резолв по ключу/slug (ручные задачи — ключ = slug), затем по числовому id (/t/42 → ARTEL-…)
  let task = all.find((t) => t.key === id || t.slug === id) ?? null;
  if (!task && Number.isFinite(num)) task = all.find((t) => t.id === num) ?? null;
  if (!task) notFound();

  // канонизируем только агентские (числовой id → /t/ARTEL-0042); ручные остаются на /t/<slug>
  if (task.id && id !== task.key) permanentRedirect(`/t/${task.key}`);

  const project = getProject(task.project, activeBed.projectsDir);
  return <TaskView task={task} project={project} />;
}
