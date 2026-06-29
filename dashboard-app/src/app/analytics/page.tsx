import Link from "next/link";
import {
  getAllTasks,
  getBurndown,
  type Task,
} from "@/lib/vault";
import PersonalBedAnalytics from "@/components/PersonalBedAnalytics";
import BurndownChart from "@/components/BurndownChart";
import GradeBadge from "@/components/GradeBadge";
import CumulativeGradeChart from "@/components/CumulativeGradeChart";
import TieringCoverageBars, { type TieringCoverageBarDay } from "@/components/TieringCoverageBars";
import TokensByGradeCard, { type TokensDataset } from "@/components/TokensByGradeCard";
import { gradeOfModel, gradeShareCumulative } from "@/lib/grade";
import { fmtTicket } from "@/lib/ui";
import { completedAt, repoFirstCommitDate } from "@/lib/git";
import { resolveActiveBed } from "@/lib/activeBed";

export const dynamic = "force-dynamic";

const TIERS = ["junior", "middle", "senior"] as const;

/** Вычислить HSL-фон пилюли хитмапы по значению (0..1 нормированное). */
function heatmapBg(normalized: number): string {
  const hue = Math.round(130 - normalized * 125);
  return `hsl(${hue} 65% 90%)`;
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">{title}</h2>
      {hint && <p className="mt-1 text-xs text-neutral-400">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

type Bucket = { io: number; cache: number };
type GradeBucket = Bucket & { models: Record<string, Bucket> };

/** Агрегация токенов по грейдам из списка задач. */
function aggregateTokens(taskList: Task[]): TokensDataset {
  const grades: Record<string, GradeBucket> = {};
  let totalIo = 0;
  taskList.forEach((t) => {
    if (!t.costByModel) return;
    const pairs = t.costByModel.split(";").map((s) => s.trim());
    pairs.forEach((pair) => {
      const [modelPart, tokenPart] = pair.split("=");
      if (!modelPart || !tokenPart) return;
      const model = modelPart.trim();
      const [io, cache] = tokenPart.split("/");
      const ioNum = parseInt(io?.trim() || "0", 10);
      const cacheNum = parseInt(cache?.trim() || "0", 10);
      const grade = gradeOfModel(model);
      const g = (grades[grade] ??= { io: 0, cache: 0, models: {} });
      g.io += ioNum;
      g.cache += cacheNum;
      const m = (g.models[model] ??= { io: 0, cache: 0 });
      m.io += ioNum;
      m.cache += cacheNum;
      totalIo += ioNum;
    });
  });
  return { grades, totalIo };
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ bed?: string }>;
}) {
  const sp = await searchParams;
  const activeBed = await resolveActiveBed(sp.bed);
  const tasks = getAllTasks(activeBed.projectsDir);
  const burndown = getBurndown(undefined, activeBed.projectsDir);

  // Ручная грядка: личная аналитика продуктивности.
  if (activeBed.type === "user") {
    const personalTasks = tasks.map((t) => ({
      key: t.key,
      project: t.project,
      status: t.status,
      summary: t.summary,
      sp: t.sp,
      createdAt: t.createdAt,
      closedAt: t.closedAt,
      due: t.due,
      personalPriority: t.personalPriority,
      recurFreq: t.recur ? t.recur.freq : null,
      completedCount: t.completedLog.length,
    }));
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Аналитика</h1>
        <p className="mt-1 text-sm text-neutral-500">Личные метрики продуктивности грядки.</p>
        <p className="mt-1 text-xs text-neutral-400">
          грядка <span className="font-medium text-neutral-600">{activeBed.name}</span>
        </p>
        <PersonalBedAnalytics bedName={activeBed.name} tasks={personalTasks} />
      </div>
    );
  }

  // --- Мемоизированный резолвер completedAt по файлу ---
  const completedAtCache = new Map<string, string>();
  function completedAtOf(t: Task): string {
    if (!completedAtCache.has(t.file)) {
      completedAtCache.set(t.file, completedAt(t.file));
    }
    return completedAtCache.get(t.file)!;
  }
  function completedDateOf(t: Task): string {
    return completedAtOf(t).slice(0, 10);
  }

  // Сегодняшняя дата в локальном времени (без UTC-сдвига)
  const now = new Date();
  const todayStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  // --- Накопительный график ---
  const importDay = repoFirstCommitDate();
  const cumPoints = gradeShareCumulative(tasks, completedAtOf);

  // --- Агрегация токенов: за всё время и сегодня ---
  const allTimeTokens = aggregateTokens(tasks);
  // Гейт по costByModel: токены даёт только измеренная задача — git-резолвер
  // completedAt дёргается лишь для ~десятков измеренных, не для всех 260 задач.
  const todayTokens = aggregateTokens(
    tasks.filter((t) => t.costByModel && t.costByModel.trim() && completedDateOf(t) === todayStr)
  );

  // --- Измеренные задачи сегодня ---
  const measured = tasks.filter((t) => t.costIoTokens > 0 && t.sp);
  const tokPerSp = (t: Task) => Math.round(t.costIoTokens / (t.sp ?? 1));
  const measuredToday = measured
    .filter((t) => completedDateOf(t) === todayStr)
    .sort((a, b) => tokPerSp(b) - tokPerSp(a));
  // компактная сводка: показываем верхние по t/SP, остальное сворачиваем —
  // чтобы карточка не растягивалась сильно выше «Токены по грейдам»
  const TODAY_MAX = 8;
  const measuredTodayShown = measuredToday.slice(0, TODAY_MAX);
  const measuredTodayHidden = measuredToday.length - measuredTodayShown.length;

  // --- Стоимость 1 SP по проектам и фактическим грейдам ---
  const costByProjectAndGrade: Record<string, Record<string, { io: number; sp: number }>> = {};
  tasks.forEach((t) => {
    if (!(t.costIoTokens > 0 && t.sp && t.costByModel)) return;
    const ioByGrade: Record<string, number> = {};
    let taskIo = 0;
    t.costByModel.split(";").forEach((pair) => {
      const [modelPart, tokenPart] = pair.split("=");
      if (!modelPart || !tokenPart) return;
      const grade = gradeOfModel(modelPart.trim());
      const ioNum = parseInt((tokenPart.split("/")[0] || "0").trim(), 10);
      ioByGrade[grade] = (ioByGrade[grade] || 0) + ioNum;
      taskIo += ioNum;
    });
    if (taskIo === 0) return;
    const proj = (costByProjectAndGrade[t.project] ??= {});
    Object.entries(ioByGrade).forEach(([grade, io]) => {
      const cell = (proj[grade] ??= { io: 0, sp: 0 });
      cell.io += io;
      cell.sp += (t.sp as number) * (io / taskIo);
    });
  });

  const projectsWithMeasured = Object.keys(costByProjectAndGrade);

  const allCosts: number[] = [];
  projectsWithMeasured.forEach((project) => {
    TIERS.forEach((grade) => {
      const data = costByProjectAndGrade[project][grade];
      if (data) allCosts.push(Math.round(data.io / data.sp));
    });
  });
  const heatMin = allCosts.length > 1 ? Math.min(...allCosts) : 0;
  const heatMax = allCosts.length > 1 ? Math.max(...allCosts) : 1;
  const heatRange = heatMax - heatMin;

  // --- Покрытие тиринга (новый вариант) ---
  // Знаменатель — все закрытые задачи (status === "done"), без фильтра sp
  const doneTasks = tasks.filter((t) => t.status === "done");
  const byDateCoverage: Record<string, { covered: number; total: number }> = {};
  doneTasks.forEach((t) => {
    // Дата закрытия из frontmatter closed_at (заполнен у всех done, бэкфилл из git) —
    // дёшево, без git-вызова на каждую из 185 done-задач; fallback на git при пустом.
    const date = (t.closedAt || "").slice(0, 10) || completedDateOf(t);
    if (!date) return;
    if (date === importDay) return; // артефакт импорта
    const cell = (byDateCoverage[date] ??= { covered: 0, total: 0 });
    cell.total += 1;
    if (t.costByModel && t.costByModel.trim() !== "") cell.covered += 1;
  });
  const coverageDays: TieringCoverageBarDay[] = Object.entries(byDateCoverage)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { covered, total }]) => ({ date, covered, total }));
  const totalDone = doneTasks.length;
  const totalCovered = doneTasks.filter((t) => t.costByModel && t.costByModel.trim() !== "").length;
  const totalPct = totalDone > 0 ? Math.round((totalCovered / totalDone) * 100) : 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Аналитика тиринга</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Грейды моделей, объём в Story Points и velocity (токены/SP). Метрика в токенах:
        работа по подписке, не по оплате за токен; токены ведутся по моделям (грейдам).
      </p>

      {/* Сводка за сегодня */}
      <div className="mt-6">
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="text-base font-semibold text-neutral-800">Сводка за сегодня</h2>
          <span className="text-xs text-neutral-400 font-mono">{todayStr}</span>
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Токены по грейдам с переключателем */}
          <TokensByGradeCard today={todayTokens} allTime={allTimeTokens} />

          {/* Измеренные сегодня */}
          <Card
            title="Измеренные сегодня"
            hint="задачи, закрытые сегодня, с залитыми токенами"
          >
            {measuredToday.length === 0 ? (
              <p className="text-sm text-neutral-400">сегодня измеренных задач пока нет</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {measuredTodayShown.map((t: Task) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      {t.modelTier && <GradeBadge tier={t.modelTier} />}
                      <Link href={`/t/${t.key}`} className="flex min-w-0 items-baseline gap-2 hover:underline">
                        <span className="shrink-0 font-mono text-xs font-semibold text-neutral-900">
                          {fmtTicket(t.id)}
                        </span>
                        <span className="truncate text-neutral-500">{t.summary || t.title}</span>
                      </Link>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-neutral-500">
                      {t.sp} SP · {tokPerSp(t).toLocaleString("ru-RU")} т/SP
                    </span>
                  </li>
                ))}
                {measuredTodayHidden > 0 && (
                  <li className="pt-1 text-center text-xs text-neutral-400">
                    + ещё {measuredTodayHidden} (показаны {TODAY_MAX} дороже по т/SP)
                  </li>
                )}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Сгорание */}
      <div className="mt-6">
        <Card
          title="Сгорание"
          hint="остаток открытой работы (в SP) во времени — событийно: +SP при создании задачи, −SP при закрытии выполненной"
        >
          <div className="mb-4 grid grid-cols-3 divide-x divide-neutral-100">
            {(
              [
                ["Осталось открытых, SP", burndown.openNow],
                ["Выполнено, SP", burndown.doneTotal],
                ["Всего, SP", burndown.total],
              ] as const
            ).map(([label, val]) => (
              <div key={label} className="px-4 text-center first:pl-0 last:pr-0">
                <div className="text-2xl font-semibold text-neutral-900">{val}</div>
                <div className="text-xs text-neutral-400">{label}</div>
              </div>
            ))}
          </div>
          {burndown.points.length > 1 ? (
            <BurndownChart points={burndown.points} />
          ) : (
            <p className="py-8 text-center text-sm text-neutral-400">
              Пока одна точка ({burndown.openNow} открытых) — график наберёт
              форму по мере закрытия задач.
            </p>
          )}
        </Card>
      </div>

      {/* Динамика грейдов (накопительно) */}
      <div className="mt-6">
        <Card
          title="Динамика грейдов (накопительно)"
          hint="накопительная доля senior/middle/junior во всех io-токенах, бакеты по 3 ч по дате закрытия (из git); последняя точка = итог за всё время"
        >
          <CumulativeGradeChart points={cumPoints} />
        </Card>
      </div>

      {/* Стоимость 1 SP по грейдам */}
      <div className="mt-6">
        <Card title="Стоимость 1 SP по грейдам" hint="токенов на 1 SP = Σ io / Σ SP, по фактическому грейду; SP задачи делится между грейдами пропорционально io">
          {projectsWithMeasured.length === 0 ? (
            <p className="text-sm text-neutral-400">мало данных — нет задач с залитыми токенами</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
                      <th className="pb-2 font-medium">Проект</th>
                      {TIERS.map((grade) => (
                        <th key={grade} className="pb-2 text-right font-medium">
                          {grade}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projectsWithMeasured.sort().map((project) => (
                      <tr key={project} className="border-t border-neutral-100">
                        <td className="py-2 pr-4 font-medium text-neutral-700">{project}</td>
                        {TIERS.map((grade) => {
                          const data = costByProjectAndGrade[project][grade];
                          const cost = data ? Math.round(data.io / data.sp) : null;
                          return (
                            <td key={grade} className="py-2 pl-4 text-right">
                              {cost !== null ? (
                                <span
                                  className="inline-block min-w-[5rem] rounded-md px-2.5 py-1 text-right font-mono text-[13px] tabular-nums text-neutral-700"
                                  style={
                                    heatRange > 0
                                      ? { backgroundColor: heatmapBg((cost - heatMin) / heatRange) }
                                      : { backgroundColor: "hsl(130 65% 90%)" }
                                  }
                                >
                                  {cost.toLocaleString("ru-RU")}
                                </span>
                              ) : (
                                <span className="text-neutral-300">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {heatRange > 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-neutral-400">
                  <span>дешевле</span>
                  <span
                    className="h-2 w-24 rounded-full"
                    style={{ background: "linear-gradient(90deg, hsl(130 65% 90%), hsl(67 65% 90%), hsl(5 65% 90%))" }}
                  />
                  <span>дороже</span>
                  <span className="ml-auto tabular-nums">
                    {heatMin.toLocaleString("ru-RU")}–{heatMax.toLocaleString("ru-RU")} токенов/SP
                  </span>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Покрытие тиринга */}
      <div className="mt-6">
        <Card
          title="Покрытие тиринга"
          hint="закрытые задачи по дням; цветом — доля с залитыми токенами"
        >
          <p className="text-sm font-semibold text-neutral-700">
            {totalCovered} из {totalDone} закрытых задач с токенами —{" "}
            <span className="text-emerald-600">{totalPct}%</span>
          </p>
          <div className="mt-4">
            {coverageDays.length <= 1 ? (
              <p className="text-xs text-neutral-400">
                динамика появится по мере закрытия задач в разные дни
              </p>
            ) : (
              <TieringCoverageBars days={coverageDays} />
            )}
          </div>
        </Card>
      </div>

      <p className="mt-4 text-xs text-neutral-400">
        Токены копятся локально (<code>task-checkpoint.py</code> при уходе с задачи) и заливаются в
        задачи vault — дашборд показывает залитое. Глобальная velocity по сессии — в локальном
        <code> tiering-report.py</code>.
      </p>
    </div>
  );
}
