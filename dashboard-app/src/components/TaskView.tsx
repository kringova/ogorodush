import Link from "next/link";
import type { Task, Project } from "@/lib/vault";
import { firstCommitDate, lastCommitDate } from "@/lib/git";
import { splitSections, findSection, dodProgress } from "@/lib/markdown";
import { STATUS_LABEL, STATUS_CLASS, fmtRice, fmtTicket, recurSummary } from "@/lib/ui";
import { effectiveGrade, actualGradeFromCostByModel } from "@/lib/grade";
import Badge from "@/components/Badge";
import GradeBadge from "@/components/GradeBadge";
import Md from "@/components/Md";
import ReviewActions from "@/components/ReviewActions";
import PlanButton from "@/components/PlanButton";

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Страница задачи. Используется на каноническом роуте /t/<key>. */
export default function TaskView({
  task,
  project,
}: {
  task: Task;
  project: Project | null;
}) {
  const slug = task.project;

  const created = task.created || firstCommitDate(task.file) || task.updated || "—";
  const lastAction = lastCommitDate(task.file) || task.updated || "—";

  // Сырой RICE из компонентов — для показа на странице задачи даже у закрытых
  // (в приоритетах/сортировке закрытые по-прежнему не участвуют: task.rice = null).
  const rawRice = task.effort ? (task.reach * task.impact * (task.confidence / 100)) / task.effort : null;

  const sections = splitSections(task.body);
  const whatToDo = findSection(sections, ["Что нужно сделать"]);
  const why = findSection(sections, ["Почему важно"]);
  const dod = findSection(sections, [
    "Критерии готовности",
    "DoD",
    "Definition of Done",
  ]);
  const prereq = findSection(sections, [
    "Пререквизиты",
    "Зависимости",
    "Предпосылки",
    "Prerequisites",
  ]);
  const questions = findSection(sections, ["Вопросы"]);
  const notes = findSection(sections, ["Заметки"]);
  const rawProg = dodProgress(dod);
  // закрытая задача → DoD выполнен по определению
  const prog =
    rawProg && task.status === "done"
      ? { done: rawProg.total, total: rawProg.total, pct: 100 }
      : rawProg;

  return (
    <div>
      <Link
        href={`/projects/${slug}`}
        className="text-sm text-neutral-400 hover:text-neutral-600"
      >
        ← {project?.slug ?? "Проект"}
      </Link>

      {/* шапка — идентификатор и метки; статус и действия живут в правой колонке */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge className="bg-neutral-100 text-neutral-500 ring-neutral-200">
          {task.project}
        </Badge>
        {task.isBug && (
          <Badge className="bg-rose-50 text-rose-600 ring-rose-200">bug</Badge>
        )}
        {task.recur && (
          <Badge className="bg-sky-50 text-sky-700 ring-sky-200">
            ↻ {recurSummary(task.recur)}
          </Badge>
        )}
      </div>

      {task.id > 0 ? (
        <>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-2xl font-semibold tracking-tight text-neutral-900">
                {fmtTicket(task.id)}
              </h1>
              <Badge className={STATUS_CLASS[task.status]}>
                {STATUS_LABEL[task.status] ?? task.status}
              </Badge>
            </div>
            {task.status === "review" && <ReviewActions taskKey={task.key} />}
            {task.status === "todo" && (
              <PlanButton taskKey={task.key} planned={task.nextUp} />
            )}
          </div>
          <p className="mt-1 text-lg text-neutral-500">
            {task.summary || task.title}
          </p>
        </>
      ) : (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {task.summary || task.title}
            </h1>
            <Badge className={STATUS_CLASS[task.status]}>
              {STATUS_LABEL[task.status] ?? task.status}
            </Badge>
          </div>
          {task.status === "review" && <ReviewActions taskKey={task.key} />}
          {task.status === "todo" && (
            <PlanButton taskKey={task.key} planned={task.nextUp} />
          )}
        </div>
      )}

      {/* мета: даты + RICE */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-neutral-500">
        <span>
          <span className="text-neutral-400">Добавлена:</span> {created}
        </span>
        <span>
          <span className="text-neutral-400">Последнее действие:</span>{" "}
          {lastAction}
        </span>
        {task.rice != null && (
          <span>
            <span className="text-neutral-400">RICE:</span>{" "}
            <span className="font-mono font-semibold text-[color:var(--color-accent)]">
              {fmtRice(task.rice)}
            </span>
          </span>
        )}
        <span>
          <span className="text-neutral-400">Оценка:</span>{" "}
          {task.sp != null ? (
            <>
              {task.sp} SP
            </>
          ) : (
            <>
              {task.estDays} идеальных дн
            </>
          )}
        </span>
        {(() => {
          const isDone = task.status === "done";
          const hasCostData = task.costByModel && task.costByModel.trim() !== "";
          if (isDone && hasCostData) {
            // фактический грейд + список моделей
            const actualGrade = actualGradeFromCostByModel(task.costByModel);
            const modelNames = task.costByModel
              .split(";")
              .map((p) => p.split("=")[0]?.trim())
              .filter(Boolean);
            return (
              <span className="flex items-center gap-1.5 flex-wrap">
                <span className="text-neutral-400">Сделано:</span>
                {actualGrade ? <GradeBadge tier={actualGrade} showLabel /> : null}
                {modelNames.length > 0 && (
                  <span className="text-neutral-500">
                    ({modelNames.join(", ")})
                  </span>
                )}
              </span>
            );
          }
          const displayTier = effectiveGrade(task);
          if (!displayTier) return null;
          return (
            <span className="flex items-center gap-1.5">
              <span className="text-neutral-400">Грейд:</span>
              <GradeBadge tier={displayTier} showLabel />
            </span>
          );
        })()}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        {/* основная колонка */}
        <div className="order-2 flex min-w-0 flex-col gap-5 lg:order-1">
          {whatToDo && (
            <Block title="Что нужно сделать">
              <Md project={slug}>{whatToDo}</Md>
            </Block>
          )}

          {/* DoD — главный блок задачи + прогресс по галочкам */}
          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Готово, когда (DoD)
              </h2>
              {prog && (
                <span className="text-sm font-medium text-neutral-500">
                  {prog.done}/{prog.total} · {prog.pct}%
                </span>
              )}
            </div>
            {prog && (
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{ width: `${prog.pct}%` }}
                />
              </div>
            )}
            <p className="mt-2 text-xs text-neutral-400">
              что станет правдой по итогу — отмечаю по мере выполнения
            </p>
            <div className="mt-3">
              {dod ? (
                <Md project={slug}>{dod}</Md>
              ) : (
                <p className="text-sm text-neutral-400">критерии не заданы</p>
              )}
            </div>
          </section>

          {why && (
            <Block title="Почему важно">
              <Md project={slug}>{why}</Md>
            </Block>
          )}
          {notes && (
            <Block title="Заметки">
              <Md project={slug}>{notes}</Md>
            </Block>
          )}
          {task.completedLog.length > 0 && (
            <Block title="История выполнений">
              <p className="mb-2 text-sm text-neutral-500">
                Выполнено {task.completedLog.length} раз
              </p>
              {task.completedLog.length <= 8 ? (
                <ul className="space-y-1">
                  {[...task.completedLog].reverse().map((d, i) => (
                    <li key={i} className="text-sm text-neutral-600">{d}</li>
                  ))}
                </ul>
              ) : (
                <details>
                  <summary className="cursor-pointer text-sm text-neutral-500 hover:text-neutral-700">
                    Показать все ({task.completedLog.length})
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {[...task.completedLog].reverse().map((d, i) => (
                      <li key={i} className="text-sm text-neutral-600">{d}</li>
                    ))}
                  </ul>
                </details>
              )}
            </Block>
          )}
        </div>

        {/* боковая колонка */}
        <aside className="order-1 flex flex-col gap-5 lg:order-2">
          {/* RICE-разбивка */}
          <Block title="RICE">
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                ["Reach", task.reach],
                ["Impact", task.impact],
                ["Conf%", task.confidence],
                ["Effort", task.effort],
              ].map(([label, val]) => (
                <div key={label} className="rounded-lg bg-neutral-50 py-2">
                  <div className="font-mono text-sm font-semibold text-neutral-800">
                    {val}
                  </div>
                  <div className="text-[10px] uppercase text-neutral-400">
                    {label}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-center text-sm text-neutral-500">
              = <span className="font-mono font-semibold text-[color:var(--color-accent)]">{fmtRice(rawRice)}</span>
              {task.rice == null && rawRice != null && (
                <span className="ml-1 text-xs text-neutral-400">· в приоритетах не учитывается (задача закрыта)</span>
              )}
            </div>
          </Block>

          <Block title="Пререквизиты">
            {prereq ? (
              <Md project={slug}>{prereq}</Md>
            ) : (
              <p className="text-sm text-neutral-400">нет — задачу можно брать</p>
            )}
          </Block>

          {questions && (
            <Block title="Вопросы">
              <Md project={slug}>{questions}</Md>
            </Block>
          )}
        </aside>
      </div>
    </div>
  );
}
