import Link from "next/link";
import { getInbox, getProjects, getAllTasks } from "@/lib/vault";
import { fmtTicket, fmtRice } from "@/lib/ui";
import InboxForm from "@/components/InboxForm";
import ReviewActions from "@/components/ReviewActions";
import Badge from "@/components/Badge";
import ReviewReport from "@/components/ReviewReport";
import { resolveActiveBed } from "@/lib/activeBed";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ bed?: string }>;
}) {
  const sp = await searchParams;
  const activeBed = await resolveActiveBed(sp.bed);
  const items = getInbox(activeBed.inboxDir);
  const projects = getProjects(activeBed.projectsDir).map((p) => p.slug);
  const review = getAllTasks(activeBed.projectsDir)
    .filter((t) => t.status === "review")
    .sort((a, b) => (b.rice ?? 0) - (a.rice ?? 0));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Инбокс</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Сверху — задачи, которые ждут твоего апрува на закрытие. Снизу — поле для
        сырых мыслей, Claude разберёт их в задачи.
      </p>

      {/* Агент → тебе: готовая работа, ждёт подтверждения на закрытие */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          На подтверждение · {review.length}
        </h2>
        {review.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-200 py-8 text-center text-sm text-neutral-400">
            Нечего подтверждать
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {review.map((t) => (
              <li
                key={t.key}
                className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/t/${t.key}`}
                    className="font-mono text-sm font-semibold text-neutral-900 hover:text-[color:var(--color-accent)]"
                  >
                    {fmtTicket(t.id)}
                  </Link>
                  {t.rice != null && (
                    <span className="font-mono text-xs text-[color:var(--color-accent)]">
                      {fmtRice(t.rice)}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[13px] leading-snug text-neutral-500">
                  {t.summary || t.title}
                </p>
                <ReviewReport task={t} />
                <div className="mt-3">
                  <Badge className="bg-neutral-100 text-neutral-500 ring-neutral-200">
                    {t.project}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
                  <ReviewActions taskKey={t.key} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Кинуть мысль
        </h2>
        <InboxForm projects={projects} />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Не разобрано · {items.length}
        </h2>
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-200 py-10 text-center text-sm text-neutral-400">
            Инбокс пуст
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((it) => (
              <li
                key={it.slug}
                className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm"
              >
                <p className="whitespace-pre-wrap text-sm text-neutral-800">
                  {it.text}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
                  {it.project && (
                    <Badge className="bg-neutral-100 text-neutral-500 ring-neutral-200">
                      {it.project}
                    </Badge>
                  )}
                  <span>{it.created.replace("T", " ").slice(0, 16)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
