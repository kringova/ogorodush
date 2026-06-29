import Link from "next/link";
import { getTasksByRice } from "@/lib/vault";
import { STATUS_CLASS, STATUS_LABEL, fmtRice, fmtTicket } from "@/lib/ui";
import Badge from "@/components/Badge";
import { resolveActiveBed } from "@/lib/activeBed";

export const dynamic = "force-dynamic";

export default async function RicePage({
  searchParams,
}: {
  searchParams: Promise<{ bed?: string }>;
}) {
  const sp = await searchParams;
  const activeBed = await resolveActiveBed(sp.bed);
  const tasks = getTasksByRice(activeBed.projectsDir);
  const max = tasks[0]?.rice ?? 1;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">RICE-приоритеты</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Открытые задачи по убыванию RICE = (reach × impact × confidence%) /
        effort
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[320px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-400">
              <th className="px-4 py-2 font-medium">Задача</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">
                Проект
              </th>
              <th className="px-3 py-2 font-medium">Статус</th>
              <th className="hidden px-3 py-2 text-center font-medium md:table-cell">
                R
              </th>
              <th className="hidden px-3 py-2 text-center font-medium md:table-cell">
                I
              </th>
              <th className="hidden px-3 py-2 text-center font-medium md:table-cell">
                C
              </th>
              <th className="hidden px-3 py-2 text-center font-medium md:table-cell">
                E
              </th>
              <th className="px-4 py-2 text-right font-medium">RICE</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr
                key={`${t.project}/${t.slug}`}
                className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/t/${t.key}`}
                    className="hover:text-[color:var(--color-accent)]"
                  >
                    <span className="font-mono text-[13px] font-semibold text-neutral-900">
                      {fmtTicket(t.id)}
                    </span>
                    <span className="ml-2 text-neutral-500">
                      {t.summary || t.title}
                    </span>
                  </Link>
                </td>
                <td className="hidden px-3 py-2.5 text-neutral-500 sm:table-cell">
                  {t.project}
                </td>
                <td className="px-3 py-2.5">
                  <Badge className={STATUS_CLASS[t.status]}>
                    {STATUS_LABEL[t.status] ?? t.status}
                  </Badge>
                </td>
                <td className="hidden px-3 py-2.5 text-center font-mono text-xs text-neutral-500 md:table-cell">
                  {t.reach}
                </td>
                <td className="hidden px-3 py-2.5 text-center font-mono text-xs text-neutral-500 md:table-cell">
                  {t.impact}
                </td>
                <td className="hidden px-3 py-2.5 text-center font-mono text-xs text-neutral-500 md:table-cell">
                  {t.confidence}
                </td>
                <td className="hidden px-3 py-2.5 text-center font-mono text-xs text-neutral-500 md:table-cell">
                  {t.effort}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-neutral-100 sm:block">
                      <span
                        className="block h-full rounded-full bg-[color:var(--color-accent)]"
                        style={{
                          width: `${Math.round(((t.rice ?? 0) / max) * 100)}%`,
                        }}
                      />
                    </span>
                    <span className="font-mono text-sm font-semibold text-neutral-800">
                      {fmtRice(t.rice)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
