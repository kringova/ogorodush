/** Префикс ключа тикета (напр. "OGOROD" → "OGOROD-0042"). Единственное место, где он задан. */
export const TICKET_PREFIX = "OGOROD";

/**
 * Параметры временной оценки и загрузки.
 * Время задач оценивается в ИДЕАЛЬНЫХ ДНЯХ (день фокус-работы).
 * Прогноз дат строится через capacity — сколько фокус-часов в неделю реально есть.
 */
export const CAPACITY_HOURS_PER_WEEK = 10; // фокус-часов в неделю на все проекты
export const HOURS_PER_IDEAL_DAY = 6; // 1 идеальный день = 6 фокус-часов
export const IDEAL_DAYS_PER_PERSON_WEEK = 5; // для перевода в RICE-effort (чел-недели)

/** Идеальных дней, которые реально закрываются за календарную неделю. */
export const IDEAL_DAYS_PER_WEEK = CAPACITY_HOURS_PER_WEEK / HOURS_PER_IDEAL_DAY;

/** Идеальные дни → календарные недели при текущей capacity. */
export function daysToCalendarWeeks(estDays: number): number {
  return estDays / IDEAL_DAYS_PER_WEEK;
}
