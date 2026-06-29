import { getAllTasks } from "@/lib/vault";
import { fmtTicket } from "@/lib/ui";
import SearchClient, { type SearchTask } from "@/components/SearchClient";
import { resolveActiveBed } from "@/lib/activeBed";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ bed?: string }>;
}) {
  const sp = await searchParams;
  const activeBed = await resolveActiveBed(sp.bed);
  const tasks: SearchTask[] = getAllTasks(activeBed.projectsDir).map((t) => {
    const open = t.status === "todo" || t.status === "doing";
    const haystack = [
      fmtTicket(t.id),
      String(t.id),
      t.summary,
      t.title,
      t.project,
      t.status,
      t.tags.join(" "),
      t.body,
    ]
      .join(" ")
      .toLowerCase();
    return {
      id: t.id,
      slug: t.slug,
      key: t.key,
      project: t.project,
      status: t.status,
      summary: t.summary,
      title: t.title,
      rice: t.rice,
      isBug: t.isBug,
      open,
      haystack,
    };
  });

  return <SearchClient tasks={tasks} />;
}
