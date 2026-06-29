import Link from "next/link";
import { getProjects, getBurndown, type BurndownPoint } from "@/lib/vault";
import BurndownChart from "@/components/BurndownChart";
import { resolveActiveBed } from "@/lib/activeBed";

export const dynamic = "force-dynamic";

const RANGES: { key: string; label: string; days: number | null }[] = [
  { key: "30", label: "30 дней", days: 30 },
  { key: "90", label: "90 дней", days: 90 },
  { key: "180", label: "Полгода", days: 180 },
  { key: "all", label: "Всё", days: null },
];

/** Оставить точки за последние `days` дней; на границе окна — перенести остаток. */
function windowPoints(points: BurndownPoint[], days: number | null) {
  if (days == null || points.length <= 1) return points;
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startIso = start.toISOString().slice(0, 10);
  const inside = points.filter((p) => p.date >= startIso);
  if (inside.length === points.length) return points;
  const before = points.filter((p) => p.date < startIso);
  if (before.length === 0) return inside;
  const carried = before[before.length - 1].remaining;
  return [{ date: startIso, remaining: carried }, ...inside];
}

export default async function BurndownPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; range?: string; bed?: string }>;
}) {
  const { project, range, bed } = await searchParams;
  const activeBed = await resolveActiveBed(bed);
  const projects = getProjects(activeBed.projectsDir);
  const slug =
    project && projects.some((p) => p.slug === project) ? project : undefined;
  const activeRange = RANGES.find((r) => r.key === range) ?? RANGES[3];
  const bd = getBurndown(slug, activeBed.projectsDir);
  const { openNow, doneTotal, total } = bd;
  const points = windowPoints(bd.points, activeRange.days);
  const qp = slug ? `&project=${slug}` : "";

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Диаграмма сгорания
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Остаток открытых задач во времени. Линия «сгорает» по датам закрытия
        выполненных задач. По мере накопления истории станет точнее.
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Link
          href={`/burndown?range=${activeRange.key}`}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            !slug
              ? "bg-neutral-900 text-white"
              : "bg-white text-neutral-600 ring-1 ring-inset ring-neutral-200 hover:bg-neutral-100"
          }`}
        >
          Все
        </Link>
        {projects.map((p) => (
          <Link
            key={p.slug}
            href={`/burndown?project=${p.slug}&range=${activeRange.key}`}
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

      {/* период отображения */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/burndown?range=${r.key}${qp}`}
            className={`rounded-md px-2.5 py-1 text-xs transition ${
              activeRange.key === r.key
                ? "bg-[color:var(--color-accent)]/10 font-medium text-[color:var(--color-accent)]"
                : "text-neutral-500 hover:bg-neutral-100"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          ["Осталось открытых", openNow],
          ["Выполнено", doneTotal],
          ["Всего в работе", total],
        ].map(([label, val]) => (
          <div
            key={label}
            className="rounded-xl border border-neutral-200 bg-white p-4 text-center shadow-sm"
          >
            <div className="text-2xl font-semibold text-neutral-900">{val}</div>
            <div className="text-xs text-neutral-400">{label}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        {points.length > 1 ? (
          <BurndownChart points={points} />
        ) : (
          <p className="py-10 text-center text-sm text-neutral-400">
            Пока одна точка ({openNow} открытых). График наберёт форму по мере
            закрытия задач.
          </p>
        )}
      </div>
    </div>
  );
}
