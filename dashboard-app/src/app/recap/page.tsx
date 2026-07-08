import { getDigests, type Digest, type DigestPeriodType } from "@/lib/vault";
import { resolveActiveBed } from "@/lib/activeBed";
import Md from "@/components/Md";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

/** Человекочитаемая подпись периода для оглавления и навигации prev/next. */
function periodLabel(d: Digest): string {
  switch (d.periodType) {
    case "month": {
      const m = d.period.match(/^(\d{4})-(\d{2})$/);
      if (!m) return d.period;
      return `${MONTH_NAMES[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
    }
    case "week": {
      const m = d.period.match(/^(\d{4})-W(\d{1,2})$/);
      return m ? `W${m[2]} · ${m[1]}` : d.period;
    }
    case "quarter": {
      const m = d.period.match(/^(\d{4})-Q(\d)$/);
      return m ? `Q${m[2]} ${m[1]}` : d.period;
    }
    case "half": {
      const m = d.period.match(/^(\d{4})-H(\d)$/);
      return m ? `H${m[2]} ${m[1]}` : d.period;
    }
    default:
      return d.period;
  }
}

/** Порядок и заголовки групп оглавления — от крупных периодов к мелким. */
const GROUPS: { type: DigestPeriodType; label: string }[] = [
  { type: "half", label: "Полугодия" },
  { type: "quarter", label: "Кварталы" },
  { type: "month", label: "Месяцы" },
  { type: "week", label: "Недели" },
  { type: "other", label: "Другое" },
];

export default async function RecapPage({
  searchParams,
}: {
  searchParams: Promise<{ bed?: string; p?: string }>;
}) {
  const sp = await searchParams;
  const bed = await resolveActiveBed(sp.bed);
  const digests = getDigests(bed.digestsDir); // уже отсортированы: новые сверху

  // выбранный дайджест по ?p; неизвестный или отсутствующий p — самый свежий
  const selected = (sp.p && digests.find((d) => d.period === sp.p)) || digests[0];

  // ссылка на другой период с сохранением ?bed
  const bedQuery = sp.bed ? `&bed=${encodeURIComponent(sp.bed)}` : "";
  const hrefFor = (period: string) => `/recap?p=${encodeURIComponent(period)}${bedQuery}`;

  // сосед по хронологии внутри того же типа периода (для prev/next)
  let prev: Digest | null = null;
  let next: Digest | null = null;
  if (selected) {
    const sameType = digests.filter((d) => d.periodType === selected.periodType);
    const idx = sameType.findIndex((d) => d.period === selected.period);
    prev = idx >= 0 && idx + 1 < sameType.length ? sameType[idx + 1] : null; // старше
    next = idx > 0 ? sameType[idx - 1] : null; // новее
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">Дайджест</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Умная сводка за период — что сделано и какой эффект, что свернули, куда движемся.
        Собирается автоматически (неделя / месяц / полгода) и хранится в грядке.
      </p>
      <p className="mt-1 text-xs text-neutral-400">
        грядка <span className="font-medium text-neutral-600">{bed.name}</span>
      </p>

      {digests.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-neutral-200 py-12 text-center text-sm text-neutral-400">
          Пока нет дайджестов. Появятся, когда закроется период — или скажи «подведи итоги за месяц».
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-start">
          <div className="order-2 min-w-0 flex-1 md:order-1">
            {(prev || next) && (
              <div className="mb-2 flex justify-between text-xs">
                <span>
                  {prev && (
                    <a href={hrefFor(prev.period)} className="text-neutral-500 hover:text-neutral-900">
                      ← {prev.period}
                    </a>
                  )}
                </span>
                <span>
                  {next && (
                    <a href={hrefFor(next.period)} className="text-neutral-500 hover:text-neutral-900">
                      {next.period} →
                    </a>
                  )}
                </span>
              </div>
            )}
            <article className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-2">
                <span className="font-mono text-xs text-neutral-400">
                  {selected.period}
                  {selected.range ? ` · ${selected.range}` : ""}
                </span>
                {selected.generated && (
                  <span className="text-xs text-neutral-400">собрано {selected.generated}</span>
                )}
              </div>
              <Md project="">{selected.body}</Md>
            </article>
          </div>

          <nav className="order-1 flex-none md:sticky md:top-6 md:order-2 md:w-56 md:self-start">
            {GROUPS.map(({ type, label }) => {
              const items = digests.filter((d) => d.periodType === type);
              if (items.length === 0) return null;
              return (
                <div key={type} className="mb-4">
                  <h2 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                    {label}
                  </h2>
                  <div className="flex flex-col">
                    {items.map((d) => (
                      <a
                        key={d.period}
                        href={hrefFor(d.period)}
                        className={
                          "rounded-md px-2 py-1 text-sm " +
                          (d.period === selected.period
                            ? "bg-neutral-100 font-medium text-neutral-900"
                            : "text-neutral-500 hover:text-neutral-900")
                        }
                      >
                        {periodLabel(d)}
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
