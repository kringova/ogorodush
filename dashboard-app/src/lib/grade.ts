/**
 * Грейды моделей — общий хелпер.
 *
 * Каталог модель→грейд НЕ захардкожен: единственный источник —
 * scripts/model-grades.json в vault, его загружает серверный код (vault.ts →
 * setModelGradesCatalog) при старте. Этот модуль остаётся клиент-безопасным
 * (без fs) — клиентские чарты импортируют отсюда только типы.
 *
 * Модель вне каталога = грейд "unknown": показывается на графиках отдельной
 * полосой, НЕ выбрасывается. Пустой/непрочитанный каталог → всё unknown —
 * рассинхрон виден на дашборде сразу, а не молчит (#490).
 */

import type { Task } from "./vault";
import { mondayOf } from "./weeks";

export type Grade = "junior" | "middle" | "senior";
export type GradeU = Grade | "unknown";

const GRADES: readonly Grade[] = ["junior", "middle", "senior"];
const ALL: readonly GradeU[] = ["junior", "middle", "senior", "unknown"];

let catalog: Record<Grade, string[]> = { junior: [], middle: [], senior: [] };

/** Инициализация каталога из model-grades.json — зовёт серверный vault.ts. */
export function setModelGradesCatalog(c: Partial<Record<Grade, string[]>>): void {
  catalog = {
    junior: (c.junior ?? []).map((s) => s.toLowerCase()),
    middle: (c.middle ?? []).map((s) => s.toLowerCase()),
    senior: (c.senior ?? []).map((s) => s.toLowerCase()),
  };
}

export function gradeOfModel(model: string): GradeU {
  const id = model.toLowerCase();
  for (const g of GRADES) {
    if (catalog[g].some((s) => id.includes(s))) return g;
  }
  return "unknown";
}

/** io-токены по грейдам из строки cost_by_model ("model=io/cache; ..."). */
function ioByGrade(costByModel: string): Record<GradeU, number> {
  const io: Record<GradeU, number> = { junior: 0, middle: 0, senior: 0, unknown: 0 };
  for (const pair of costByModel.split(";")) {
    const [modelPart, tokenPart] = pair.split("=");
    if (!modelPart || !tokenPart) continue;
    const grade = gradeOfModel(modelPart.trim());
    const ioNum = parseInt((tokenPart.split("/")[0] || "0").trim(), 10);
    io[grade] = (io[grade] || 0) + ioNum;
  }
  return io;
}

/**
 * Доминирующий грейд по io-токенам из строки cost_by_model.
 * Возвращает грейд с максимальным суммарным io ("unknown", если доминирует
 * модель вне каталога), или null если нет данных.
 */
export function actualGradeFromCostByModel(costByModel: string): GradeU | null {
  if (!costByModel || !costByModel.trim()) return null;
  const io = ioByGrade(costByModel);
  let maxGrade: GradeU | null = null;
  let maxIo = 0;
  for (const g of ALL) {
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
  unknownPct: number | null;
}

export interface GradeShareDayPoint {
  date: string;          // YYYY-MM-DD — дата завершения (из git)
  seniorPct: number | null;
  middlePct: number | null;
  juniorPct: number | null;
  unknownPct: number | null;
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
  const byDay = new Map<string, { io: Record<GradeU, number>; count: number }>();
  for (const t of measured) {
    const day = dateOf(t);
    if (!day) continue; // без стабильной даты завершения — не кластеризуем (не пачкаем ось)
    if (!byDay.has(day)) {
      byDay.set(day, { io: { junior: 0, middle: 0, senior: 0, unknown: 0 }, count: 0 });
    }
    const bucket = byDay.get(day)!;
    bucket.count += 1;
    const io = ioByGrade(t.costByModel);
    for (const g of ALL) bucket.io[g] += io[g];
  }

  // Построить точки, отсортировать по дате
  const points: GradeShareDayPoint[] = [];
  for (const [date, { io, count }] of byDay) {
    const totalIo = ALL.reduce((s, g) => s + io[g], 0);
    const pct = (g: GradeU) => (totalIo > 0 ? (100 * io[g]) / totalIo : null);
    points.push({
      date,
      seniorPct: pct("senior"),
      middlePct: pct("middle"),
      juniorPct: pct("junior"),
      unknownPct: pct("unknown"),
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
 * Возвращает pct от суммарного io всех грейдов, включая unknown.
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
    const io = ioByGrade(t.costByModel);
    const totalIo = ALL.reduce((s, g) => s + io[g], 0);
    const pct = (g: GradeU) => (totalIo > 0 ? (100 * io[g]) / totalIo : null);
    return {
      date: t.updated,
      key: t.key,
      seniorPct: pct("senior"),
      middlePct: pct("middle"),
      juniorPct: pct("junior"),
      unknownPct: pct("unknown"),
    };
  });
}

export interface WeeklyGradePoint {
  /** Понедельник ISO-недели закрытия (YYYY-MM-DD). */
  weekStart: string;
  io: Record<GradeU, number>;
  totalIo: number;
  pct: Record<GradeU, number>;
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

  const buckets = new Map<string, { io: Record<GradeU, number>; count: number }>();
  for (const t of measured) {
    const iso = isoOf(t);
    const date = iso ? iso.slice(0, 10) : "";
    if (!date) continue;
    const week = mondayOf(date);
    let b = buckets.get(week);
    if (!b) {
      b = { io: { junior: 0, middle: 0, senior: 0, unknown: 0 }, count: 0 };
      buckets.set(week, b);
    }
    b.count += 1;
    const io = ioByGrade(t.costByModel);
    for (const g of ALL) b.io[g] += io[g];
  }

  const weeks = [...buckets.keys()].sort();
  return weeks.map((weekStart) => {
    const b = buckets.get(weekStart)!;
    const totalIo = ALL.reduce((s, g) => s + b.io[g], 0);
    const pctOf = (g: GradeU) => (totalIo > 0 ? (100 * b.io[g]) / totalIo : 0);
    return {
      weekStart,
      io: b.io,
      totalIo,
      pct: {
        junior: pctOf("junior"),
        middle: pctOf("middle"),
        senior: pctOf("senior"),
        unknown: pctOf("unknown"),
      },
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
