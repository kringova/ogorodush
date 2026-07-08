import { dueUrgency } from "@/lib/ui";
import BedLink from "@/components/BedLink";

export interface PersonalTask {
  key: string;
  project: string;
  status: string;
  summary: string;
  sp: number | null;
  createdAt: string;
  closedAt: string;
  due: string;
  personalPriority: number | null;
  recurFreq: string | null;
  completedCount: number;
}

// ---- Local helpers ----

function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Отображаемый ключ задачи: для OGOROD-### задач — key уже содержит ключ. */
function taskDisplayKey(t: PersonalTask): string {
  return t.key;
}

function Card({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-neutral-200 bg-white p-5 shadow-sm${className ? ` ${className}` : ""}`}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">{title}</h2>
      {hint && <p className="mt-1 text-xs text-neutral-400">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

// Server component — no "use client" needed
export default function PersonalBedAnalytics({
  tasks,
}: {
  bedName: string;
  tasks: PersonalTask[];
}) {
  const now = new Date();
  const OPEN_STATUSES = ["todo", "doing", "review", "blocked"];

  // ---- 1. Cycle time ----
  // Done-задачи с обоими датами: дни = (closedAt - createdAt). Считаем медиану и среднее.
  const cycleTimes: number[] = [];
  for (const t of tasks) {
    if (t.status !== "done") continue;
    const created = parseDate(t.createdAt);
    const closed = parseDate(t.closedAt);
    if (!created || !closed) continue;
    const days = (closed.getTime() - created.getTime()) / 86_400_000;
    if (days >= 0) cycleTimes.push(days);
  }
  const cycleMedian = median(cycleTimes);
  const cycleAvg =
    cycleTimes.length
      ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
      : null;

  // ---- 2. Tempo: done-задачи по 7-дневным бакетам за последние 8 недель ----
  // Бакет i=0 — самая старая (8 недель назад), i=7 — текущая неделя.
  const WEEKS = 8;
  const weekBuckets = Array.from({ length: WEEKS }, (_, i) => {
    const end = new Date(now.getTime() - (WEEKS - 1 - i) * 7 * 86_400_000);
    const start = new Date(now.getTime() - (WEEKS - i) * 7 * 86_400_000);
    return { start, end, count: 0 };
  });

  for (const t of tasks) {
    if (t.status !== "done" || !t.closedAt) continue;
    const closed = parseDate(t.closedAt);
    if (!closed) continue;
    for (const b of weekBuckets) {
      if (closed >= b.start && closed < b.end) {
        b.count++;
        break;
      }
    }
  }
  const tempoMax = Math.max(...weekBuckets.map((b) => b.count), 1);

  // ---- 3. Дедлайны: открытые задачи с due ----
  // Счётчики по urgency, топ-5 (просроченные/горящие сверху, потом по дате asc).
  const openWithDue = tasks.filter(
    (t) => OPEN_STATUSES.includes(t.status) && t.due
  );
  const overdueCount = openWithDue.filter((t) => dueUrgency(t.due) === "overdue").length;
  const soonCount = openWithDue.filter((t) => dueUrgency(t.due) === "soon").length;
  const urgencyOrder: Record<string, number> = { overdue: 0, soon: 1, normal: 2 };
  const top5Due = [...openWithDue]
    .sort((a, b) => {
      const ua = urgencyOrder[dueUrgency(a.due) ?? "normal"] ?? 2;
      const ub = urgencyOrder[dueUrgency(b.due) ?? "normal"] ?? 2;
      if (ua !== ub) return ua - ub;
      return a.due.localeCompare(b.due);
    })
    .slice(0, 5);

  // ---- 4. Застрявшее: открытые todo, старые сверху ----
  // Топ-5 по дате createdAt (asc), возраст = сегодня − createdAt в днях.
  const stuck = tasks
    .filter((t) => t.status === "todo")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, 5)
    .map((t) => {
      const created = parseDate(t.createdAt);
      const age = created
        ? Math.floor((now.getTime() - created.getTime()) / 86_400_000)
        : null;
      return { ...t, age };
    });

  // ---- 5. Приоритет: открытые задачи по уровню personalPriority ----
  // высокий ≥24 / средний ≥8 / низкий <8 / без оценки (null).
  const openTasks = tasks.filter((t) => !["done", "cancelled"].includes(t.status));
  const prioHigh = openTasks.filter(
    (t) => t.personalPriority !== null && t.personalPriority >= 24
  );
  const prioMed = openTasks.filter(
    (t) => t.personalPriority !== null && t.personalPriority >= 8 && t.personalPriority < 24
  );
  const prioLow = openTasks.filter(
    (t) => t.personalPriority !== null && t.personalPriority < 8
  );
  const prioNone = openTasks.filter((t) => t.personalPriority === null);
  const prioMax = Math.max(prioHigh.length, prioMed.length, prioLow.length, prioNone.length, 1);

  // ---- 6. Регулярные: задачи с recurFreq ----
  const recurring = tasks.filter((t) => t.recurFreq !== null);

  // ---- 7. По проектам: открыто (не done/cancelled) / закрыто (done) ----
  const byProject: Record<string, { open: number; done: number }> = {};
  for (const t of tasks) {
    if (!byProject[t.project]) byProject[t.project] = { open: 0, done: 0 };
    if (t.status === "done") byProject[t.project].done++;
    else if (t.status !== "cancelled") byProject[t.project].open++;
  }
  const projectEntries = Object.entries(byProject).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* 1. Время до закрытия (cycle time) */}
      <Card
        title="Время до закрытия"
        hint="медиана и среднее по done-задачам с датами создания и закрытия"
      >
        {cycleMedian === null ? (
          <p className="text-sm text-neutral-400">нет данных</p>
        ) : (
          <div className="flex gap-8">
            <div>
              <div className="font-mono text-2xl font-semibold text-neutral-900">
                {cycleMedian.toFixed(1)}
              </div>
              <div className="text-xs uppercase tracking-wide text-neutral-400">медиана, дни</div>
            </div>
            <div>
              <div className="font-mono text-2xl font-semibold text-neutral-600">
                {cycleAvg!.toFixed(1)}
              </div>
              <div className="text-xs uppercase tracking-wide text-neutral-400">среднее, дни</div>
            </div>
          </div>
        )}
        {cycleTimes.length > 0 && (
          <p className="mt-2 text-xs text-neutral-400">{cycleTimes.length} задач с данными</p>
        )}
      </Card>

      {/* 2. Темп закрытий */}
      <Card
        title="Темп закрытий"
        hint="done-задачи по 7-дневным бакетам, последние 8 недель"
      >
        <ul className="flex flex-col gap-1.5">
          {weekBuckets.map((b, i) => {
            const d = b.start;
            const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
            return (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span className="w-12 shrink-0 font-mono text-neutral-400">{dateStr}</span>
                <div className="relative h-4 flex-1 overflow-hidden rounded bg-neutral-100">
                  {b.count > 0 && (
                    <div
                      className="h-full rounded bg-emerald-400"
                      style={{
                        width: `${Math.max(Math.round((b.count / tempoMax) * 100), 4)}%`,
                      }}
                    />
                  )}
                </div>
                <span className="w-5 shrink-0 text-right font-semibold text-neutral-700">
                  {b.count}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* 3. Дедлайны — на всю ширину */}
      <Card
        title="Дедлайны"
        hint="открытые задачи с непустым due"
        className="sm:col-span-2"
      >
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="font-mono text-xl font-semibold text-red-600">{overdueCount}</span>
            <span className="ml-1 text-xs uppercase tracking-wide text-neutral-400">просрочено</span>
          </div>
          <div>
            <span className="font-mono text-xl font-semibold text-amber-600">{soonCount}</span>
            <span className="ml-1 text-xs uppercase tracking-wide text-neutral-400">
              горит ≤7 дней
            </span>
          </div>
          <div>
            <span className="font-mono text-xl font-semibold text-neutral-500">
              {openWithDue.length}
            </span>
            <span className="ml-1 text-xs uppercase tracking-wide text-neutral-400">
              всего с датой
            </span>
          </div>
        </div>
        {top5Due.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">нет открытых задач с дедлайном</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {top5Due.map((t) => {
              const urg = dueUrgency(t.due);
              const dateClass =
                urg === "overdue"
                  ? "text-red-600"
                  : urg === "soon"
                  ? "text-amber-600"
                  : "text-neutral-500";
              return (
                <li key={t.key} className="flex items-center justify-between gap-2 text-sm">
                  <BedLink
                    href={`/t/${t.key}`}
                    className="flex min-w-0 items-baseline gap-2 hover:underline"
                  >
                    <span className="shrink-0 font-mono text-xs font-semibold text-neutral-700">
                      {taskDisplayKey(t)}
                    </span>
                    <span className="truncate text-neutral-500">{t.summary || t.key}</span>
                  </BedLink>
                  <span className={`shrink-0 font-mono text-xs ${dateClass}`}>{t.due}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* 4. Застрявшее */}
      <Card
        title="Застрявшее"
        hint="открытые todo, сортировка по createdAt (старые сверху), топ-5"
      >
        {stuck.length === 0 ? (
          <p className="text-sm text-neutral-400">нет задач в todo</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {stuck.map((t) => (
              <li key={t.key} className="flex items-center justify-between gap-2 text-sm">
                <BedLink
                  href={`/t/${t.key}`}
                  className="flex min-w-0 items-baseline gap-2 hover:underline"
                >
                  <span className="shrink-0 font-mono text-xs font-semibold text-neutral-700">
                    {taskDisplayKey(t)}
                  </span>
                  <span className="truncate text-neutral-500">{t.summary || t.key}</span>
                </BedLink>
                {t.age !== null && (
                  <span className="shrink-0 font-mono text-xs text-neutral-400">{t.age}д</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 5. Распределение по приоритету */}
      <Card
        title="Приоритет"
        hint="открытые задачи по уровню personalPriority"
      >
        <ul className="flex flex-col gap-2.5">
          {(
            [
              { label: "Высокий (≥24)", count: prioHigh.length, color: "bg-rose-400" },
              { label: "Средний (≥8)", count: prioMed.length, color: "bg-amber-400" },
              { label: "Низкий (<8)", count: prioLow.length, color: "bg-sky-400" },
              { label: "Без оценки", count: prioNone.length, color: "bg-neutral-300" },
            ] as const
          ).map(({ label, count, color }) => (
            <li key={label}>
              <div className="mb-0.5 flex justify-between text-xs text-neutral-600">
                <span>{label}</span>
                <span className="font-semibold text-neutral-800">{count}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={`h-full rounded-full ${color}`}
                  style={{
                    width: `${count > 0 ? Math.max(Math.round((count / prioMax) * 100), 2) : 0}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* 6. Регулярные */}
      <Card
        title="Регулярные"
        hint="задачи с полем recur (повторяющиеся)"
      >
        {recurring.length === 0 ? (
          <p className="text-sm text-neutral-400">нет повторяющихся задач</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recurring.map((t) => (
              <li key={t.key} className="flex items-center justify-between gap-2 text-sm">
                <BedLink
                  href={`/t/${t.key}`}
                  className="flex min-w-0 items-baseline gap-2 hover:underline"
                >
                  <span className="shrink-0 font-mono text-xs font-semibold text-neutral-700">
                    {taskDisplayKey(t)}
                  </span>
                  <span className="truncate text-neutral-500">{t.summary || t.key}</span>
                </BedLink>
                <span className="shrink-0 text-xs text-neutral-400">
                  {t.recurFreq} · {t.completedCount}×
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 7. По проектам */}
      <Card
        title="По проектам"
        hint="открыто (не done/cancelled) · закрыто (done) на проект"
      >
        {projectEntries.length === 0 ? (
          <p className="text-sm text-neutral-400">нет задач</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {projectEntries.map(([proj, { open, done }]) => (
              <li
                key={proj}
                className="flex items-center justify-between gap-2 py-1.5 text-sm"
              >
                <span className="font-medium text-neutral-700">{proj}</span>
                <span className="font-mono text-xs text-neutral-500">
                  открыто{" "}
                  <span className="font-semibold text-neutral-800">{open}</span>
                  {" · "}закрыто{" "}
                  <span className="font-semibold text-emerald-700">{done}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
