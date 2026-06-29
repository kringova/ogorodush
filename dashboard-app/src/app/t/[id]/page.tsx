import { permanentRedirect, notFound } from "next/navigation";
import { getTaskById, getProject } from "@/lib/vault";
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
  const task = Number.isFinite(num) ? getTaskById(num, activeBed.projectsDir) : null;
  if (!task) notFound();

  // канонизируем: /t/42 или иные формы → /t/ARTEL-0042
  if (id !== task.key) permanentRedirect(`/t/${task.key}`);

  const project = getProject(task.project, activeBed.projectsDir);
  return <TaskView task={task} project={project} />;
}
