"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Badge from "@/components/Badge";
import { STATUS_CLASS, STATUS_LABEL, fmtRice, fmtTicket } from "@/lib/ui";

export type SearchTask = {
  id: number;
  slug: string;
  key: string;
  project: string;
  status: string;
  summary: string;
  title: string;
  rice: number | null;
  isBug: boolean;
  open: boolean; // todo/doing — открытая задача
  haystack: string; // предпосчитанная строка для поиска (lowercase)
};

const STATUS_FILTERS = [
  { key: "all", label: "Все" },
  { key: "open", label: "Открытые" },
  { key: "todo", label: "Todo" },
  { key: "doing", label: "В работе" },
  { key: "done", label: "Готово" },
] as const;

export default function SearchClient({ tasks }: { tasks: SearchTask[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]["key"]>("all");

  const results = useMemo(() => {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    return tasks
      .filter((t) => {
        if (filter === "open" && !t.open) return false;
        if (filter !== "all" && filter !== "open" && t.status !== filter) return false;
        return tokens.every((tok) => t.haystack.includes(tok));
      })
      .sort((a, b) => {
        // открытые выше, затем по RICE убыв., затем по id
        if (a.open !== b.open) return a.open ? -1 : 1;
        const ra = a.rice ?? -1;
        const rb = b.rice ?? -1;
        if (rb !== ra) return rb - ra;
        return b.id - a.id;
      });
  }, [q, filter, tasks]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Поиск задач</h1>
      <p className="mt-1 text-sm text-neutral-500">
        По номеру, названию, проекту, тегам и тексту задачи. Несколько слов — все должны встретиться.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            ⌕
          </span>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="налог, поиск, OGOROD-42…"
            className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[color:var(--color-accent)]"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded px-1.5 text-neutral-400 hover:text-neutral-700"
              aria-label="Очистить"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                filter === f.key
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-neutral-400">
        {results.length} {plural(results.length, "задача", "задачи", "задач")}
        {q && ` по запросу «${q}»`}
      </p>

      <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <tbody>
            {results.map((t) => (
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
                    {t.isBug && <span className="ml-2 mr-1">🐛</span>}
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
                <td className="px-4 py-2.5 text-right font-mono text-sm font-semibold text-neutral-800">
                  {fmtRice(t.rice)}
                </td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-neutral-400">
                  {q ? "Ничего не нашлось" : "Начни вводить запрос"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
