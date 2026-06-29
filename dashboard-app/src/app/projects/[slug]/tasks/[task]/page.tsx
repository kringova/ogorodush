import { permanentRedirect, notFound } from "next/navigation";
import { getTask } from "@/lib/vault";
import { resolveActiveBed } from "@/lib/activeBed";

export const dynamic = "force-dynamic";

/**
 * Старый длинный адрес и wiki-ссылки (по slug) → 301 на короткий канон /t/<key>.
 * Сохраняет работоспособность всех ранее расшаренных ссылок.
 */
export default async function TaskLegacyRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; task: string }>;
  searchParams: Promise<{ bed?: string }>;
}) {
  const { slug, task: taskSlug } = await params;
  const sp = await searchParams;
  const activeBed = await resolveActiveBed(sp.bed);
  const task = getTask(slug, taskSlug, activeBed.projectsDir);
  if (!task) notFound();
  permanentRedirect(`/t/${task.key}`);
}
