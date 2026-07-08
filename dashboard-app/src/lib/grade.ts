/**
 * Грейды моделей — общий хелпер.
 * Зеркало grade_of() в scripts/tiering-snapshot.py (vault).
 * Источник истины один: меняется адаптер → правим там и тут.
 */

import type { Task } from "./vault";
import { mondayOf } from "./weeks";

export function gradeOfModel(model: string): "junior" | "middle" | "senior" | "other" {
  if (model.includes("haiku")) return "junior";
  if (model.includes("sonnet")) return "middle";
  if (model.includes("opus")) return "senior";
  return "other";
}

/**
 * Доминирующий грейд по io-токенам из строки cost_by_model.
 * Формат: "model=io/cache; ..."
 * Возвращает грейд с максимальным суммарным io, или null если нет данных.
 */
export function actualGradeFromCostByModel(
  costByModel: string
): "junior" | "middle" | "senior" | null {
  if (!costByModel || !costByModel.trim()) return null;
  const io: Record<string, number> = { junior: 0, middle: 0, senior: 0 };
  for (const pair of costByModel.split(";")) {
    const [modelPart, tokenPart] = pair.split("=");
    if (!modelPart || !tokenPart) continue;
    const model = modelPart.trim();
    const grade = gradeOfModel(model);
    if (grade === "other") continue;
    const ioNum = parseInt((tokenPart.split("/")[0] || "0").trim(), 10);
    io[grade] = (io[grade] || 0) + ioNum;
  }
  const best = (["senior", "middle", "junior"] as const).find((g) => io[g] > 0);
  if (!best) return null;
  // грейд с макс io
  let maxGrade: "junior" | "middle" | "senior" = best;
  let maxIo = io[best];
  for (const g of ["junior", "middle", "senior"] as const) {
    if (io[g] > maxIo) {
      maxIo = io[g];
      maxGrade = g;
    }
  }
  return maxGrade;
}

/**
 * Эффективный грейд задачи:
 * - done + costByModel → фактический (actualGradeFromCostByModel)
 * - иначе → плановый (modelTier)
 */
export function effectiveGrade(t: {
  status: string;
  costByModel: string;
  modelTier: string | null;
}): string | null {
  if (t.status === "done" && t.costByModel && t.costByModel.trim()) {
    return actualGradeFromCostByModel(t.costByModel);
  }
  return t.modelTier;
}

export interface GradeSharePoint {
  date: string; // updated date of the task
  key: string;  // task key (OGOROD-####)
  seniorPct: number | null;
  middlePct: number | null;
  juniorPct: number | null;
}

export interface GradeShareDayPoint {
  date: string;          // YYYY-MM-DD — дата завершения (из git)
  seniorPct: number | null;
  middlePct: number | null;
  juniorPct: number | null;
  count: number;         // кол-во задач в кластере
}

/**
 * Доля грейдов по ДНЯМ.
 * Каждая точка — один день, сгруппированы задачи по дате завершения.
 *
 * @param tasks   — все задачи
 * @param dateOf  — резолвер: задача → YYYY-MM-DD (дата завершения из git, без side-effects в grade.ts)
 */
export function gradeShareByDay(
  tasks: Task[],
  dateOf: (t: Task) => string
): GradeShareDayPoint[] {
  // measured = задачи с io-токенами (без фильтра по статусу — review тоже)
  const measured = tasks.filter(
    (t) => t.costIoTokens > 0 && t.costByModel && t.costByModel.trim()
  );

  // Сгруппировать по дню
  const byDay = new Map<string, { io: Record<"junior" | "middle" | "senior", number>; count: number }>();
  for (const t of measured) {
    const day = dateOf(t);
    if (!day) continue; // без стабильной даты завершения — не кластеризуем (не пачкаем ось)
    if (!byDay.has(day)) {
      byDay.set(day, { io: { junior: 0, middle: 0, senior: 0 }, count: 0 });
    }
    const bucket = byDay.get(day)!;
    bucket.count += 1;
    for (const pair of t.costByModel.split(";")) {
      const [modelPart, tokenPart] = pair.split("=");
      if (!modelPart || !tokenPart) continue;
      const grade = gradeOfModel(modelPart.trim());
      if (grade === "other") continue;
      const ioNum = parseInt((tokenPart.split("/")[0] || "0").trim(), 10);
      bucket.io[grade] += ioNum;
    }
  }

  // Построить точки, отсортировать по дате
  const points: GradeShareDayPoint[] = [];
  for (const [date, { io, count }] of byDay) {
    const totalIo = io.junior + io.middle + io.senior;
    const pct = (g: "junior" | "middle" | "senior") =>
      totalIo > 0 ? (100 * io[g]) / totalIo : null;
    points.push({
      date,
      seniorPct: pct("senior"),
      middlePct: pct("middle"),
      juniorPct: pct("junior"),
      count,
    });
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

/**
 * Доля грейдов по задачам.
 * Каждая точка — одна измеренная задача (costIoTokens > 0 && costByModel).
 * Сортировка: по (updated asc, id asc).
 * Для каждой задачи считается io по junior/middle/senior;
 * grade "other" игнорируется при расчёте процентов.
 * Возвращает pct от суммарного io junior+middle+senior.
 */
export function gradeShareByTask(tasks: Task[]): GradeSharePoint[] {
  const measured = tasks.filter(
    (t) => t.costIoTokens > 0 && t.costByModel && t.costByModel.trim()
  );

  measured.sort((a, b) => {
    const dateCmp = a.updated.localeCompare(b.updated);
    if (dateCmp !== 0) return dateCmp;
    return a.id - b.id;
  });

  return measured.map((t) => {
    const io: Record<"junior" | "middle" | "senior", number> = {
      junior: 0,
      middle: 0,
      senior: 0,
    };
    for (const pair of t.costByModel.split(";")) {
      const [modelPart, tokenPart] = pair.split("=");
      if (!modelPart || !tokenPart) continue;
      const grade = gradeOfModel(modelPart.trim());
      if (grade === "other") continue;
      const ioNum = parseInt((tokenPart.split("/")[0] || "0").trim(), 10);
      io[grade] += ioNum;
    }
    const totalIo = io.junior + io.middle + io.senior;
    const pct = (g: "junior" | "middle" | "senior") =>
      totalIo > 0 ? (100 * io[g]) / totalIo : null;
    return {
      date: t.updated,
      key: t.key,
      seniorPct: pct("senior"),
      middlePct: pct("middle"),
      juniorPct: pct("junior"),
    };
  });
}

export interface WeeklyGradePoint {
  /** Понедельник ISO-недели закрытия (YYYY-MM-DD). */
  weekStart: string;
  io: Record<"junior" | "middle" | "senior", number>;
  totalIo: number;
  pct: Record<"junior" | "middle" | "senior", number>;
  /** сколько измеренных задач закрыто на этой неделе */
  count: number;
}

/**
 * Доля io-токенов по грейдам, сгруппированная по ISO-неделям даты закрытия.
 * Недели без измеренных задач в выдачу не попадают (сжатая ось — только
 * активные недели), в отличие от старой накопительной версии.
 */
export function weeklyGradeShare(
  tasks: Task[],
  isoOf: (t: Task) => string
): WeeklyGradePoint[] {
  const measured = tasks.filter(
    (t) => t.costIoTokens > 0 && t.costByModel && t.costByModel.trim()
  );

  const buckets = new Map<
    string,
    { io: Record<"junior" | "middle" | "senior", number>; count: number }
  >();
  for (const t of measured) {
    const iso = isoOf(t);
    const date = iso ? iso.slice(0, 10) : "";
    if (!date) continue;
    const week = mondayOf(date);
    let b = buckets.get(week);
    if (!b) {
      b = { io: { junior: 0, middle: 0, senior: 0 }, count: 0 };
      buckets.set(week, b);
    }
    b.count += 1;
    for (const pair of t.costByModel.split(";")) {
      const [modelPart, tokenPart] = pair.split("=");
      if (!modelPart || !tokenPart) continue;
      const grade = gradeOfModel(modelPart.trim());
      if (grade === "other") continue;
      const ioNum = parseInt((tokenPart.split("/")[0] || "0").trim(), 10);
      b.io[grade] += ioNum;
    }
  }

  const weeks = [...buckets.keys()].sort();
  return weeks.map((weekStart) => {
    const b = buckets.get(weekStart)!;
    const totalIo = b.io.junior + b.io.middle + b.io.senior;
    const pctOf = (g: "junior" | "middle" | "senior") =>
      totalIo > 0 ? (100 * b.io[g]) / totalIo : 0;
    return {
      weekStart,
      io: b.io,
      totalIo,
      pct: { junior: pctOf("junior"), middle: pctOf("middle"), senior: pctOf("senior") },
      count: b.count,
    };
  });
}

/**
 * Скользящее среднее с окном window (по умолчанию 5).
 * На каждой позиции берёт до window предшествующих (включительно) ненулевых значений
 * и возвращает их среднее, или null если ненулевых нет.
 */
export function movingAvg(
  values: (number | null)[],
  window = 5
): (number | null)[] {
  return values.map((_, idx) => {
    const nonNull: number[] = [];
    for (let j = Math.max(0, idx - window + 1); j <= idx; j++) {
      if (values[j] !== null) nonNull.push(values[j] as number);
    }
    return nonNull.length > 0
      ? nonNull.reduce((s, v) => s + v, 0) / nonNull.length
      : null;
  });
}
