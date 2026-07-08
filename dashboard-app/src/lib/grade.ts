/**
 * Грейды моделей — общий хелпер.
 * Зеркало grade_of() в scripts/tiering-snapshot.py (vault).
 * Источник истины один: меняется адаптер → правим там и тут.
 */

import type { Task } from "./vault";

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

export interface GradeCumulativePoint {
  iso: string;            // ISO начала 3-часового бакета
  seniorPct: number | null;
  middlePct: number | null;
  juniorPct: number | null;
  cumIo: number;          // накопленный суммарный io к этому бакету
  bucketCount: number;    // сколько задач закрыто именно в этом бакете
}

/**
 * Накопительная доля грейдов по бакетам (по умолчанию 3 часа).
 * Каждая точка — бакет (включая пустые в середине ряда), значения — накопленные
 * с самого начала. Пустые бакеты дают плоские участки — видны паузы.
 *
 * Ведущие бакеты, пока накоплено < `leadTrimShare` от всех io-токенов, не
 * показываются (их токены переносятся в накопитель — последняя точка остаётся
 * равной итогу за всё время). Это срезает одинокий ранний хвост из мелких задач,
 * который иначе держит 100% одного грейда на пустом месте. Порог 0 = не срезать.
 */
export function gradeShareCumulative(
  tasks: Task[],
  isoOf: (t: Task) => string,
  bucketHours = 3,
  leadTrimShare = 0.01
): GradeCumulativePoint[] {
  // measured = задачи с io-токенами
  const measured = tasks.filter(
    (t) => t.costIoTokens > 0 && t.costByModel && t.costByModel.trim()
  );

  // Для каждой задачи: iso и io-дельты по грейдам
  type TaskEntry = {
    tMs: number;
    io: Record<"junior" | "middle" | "senior", number>;
  };

  const entries: TaskEntry[] = [];
  for (const t of measured) {
    const iso = isoOf(t);
    if (!iso) continue;
    const tMs = new Date(iso).getTime();
    if (isNaN(tMs)) continue;
    const io: Record<"junior" | "middle" | "senior", number> = { junior: 0, middle: 0, senior: 0 };
    for (const pair of t.costByModel.split(";")) {
      const [modelPart, tokenPart] = pair.split("=");
      if (!modelPart || !tokenPart) continue;
      const grade = gradeOfModel(modelPart.trim());
      if (grade === "other") continue;
      const ioNum = parseInt((tokenPart.split("/")[0] || "0").trim(), 10);
      io[grade] += ioNum;
    }
    entries.push({ tMs, io });
  }

  if (entries.length === 0) return [];

  const bucketMs = bucketHours * 3600 * 1000;
  const minMs = Math.min(...entries.map((e) => e.tMs));
  const maxMs = Math.max(...entries.map((e) => e.tMs));
  const startAligned = Math.floor(minMs / bucketMs) * bucketMs;
  const lastIdx = Math.floor((maxMs - startAligned) / bucketMs);

  // Раскидать дельты по бакетам
  const buckets = new Map<number, { io: Record<"junior" | "middle" | "senior", number>; count: number }>();
  for (const entry of entries) {
    const idx = Math.floor((entry.tMs - startAligned) / bucketMs);
    if (!buckets.has(idx)) {
      buckets.set(idx, { io: { junior: 0, middle: 0, senior: 0 }, count: 0 });
    }
    const b = buckets.get(idx)!;
    b.count += 1;
    b.io.junior += entry.io.junior;
    b.io.middle += entry.io.middle;
    b.io.senior += entry.io.senior;
  }

  // Порог обрезки ведущих бакетов: накопленный io, ниже которого точки не
  // показываем (токены при этом продолжают копиться → последняя точка = итог).
  const grandTotal = entries.reduce(
    (s, e) => s + e.io.junior + e.io.middle + e.io.senior,
    0
  );
  const trimBelow = leadTrimShare > 0 ? grandTotal * leadTrimShare : 0;

  // Пройти все бакеты включительно, накапливая
  const running: Record<"junior" | "middle" | "senior", number> = { junior: 0, middle: 0, senior: 0 };
  const points: GradeCumulativePoint[] = [];
  let started = false;
  for (let idx = 0; idx <= lastIdx; idx++) {
    const b = buckets.get(idx);
    if (b) {
      running.junior += b.io.junior;
      running.middle += b.io.middle;
      running.senior += b.io.senior;
    }
    const totalIo = running.junior + running.middle + running.senior;
    // Ведущие бакеты пропускаем, пока накопленное не дотянет до порога.
    if (!started && totalIo < trimBelow) continue;
    started = true;
    const pct = (g: "junior" | "middle" | "senior") =>
      totalIo > 0 ? (100 * running[g]) / totalIo : null;
    points.push({
      iso: new Date(startAligned + idx * bucketMs).toISOString(),
      seniorPct: pct("senior"),
      middlePct: pct("middle"),
      juniorPct: pct("junior"),
      cumIo: totalIo,
      bucketCount: b?.count ?? 0,
    });
  }

  return points;
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
