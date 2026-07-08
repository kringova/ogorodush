/**
 * Общие хелперы бакетирования по ISO-неделям (понедельник–воскресенье).
 * Даты трактуются как UTC-полночь (даты во frontmatter — наивные календарные
 * дни), чтобы не зависеть от таймзоны сервера/клиента.
 */

/** Понедельник ISO-недели, содержащей дату (YYYY-MM-DD) → YYYY-MM-DD. */
export function mondayOf(dateIso: string): string {
  const d = new Date(dateIso + "T00:00:00Z");
  const day = d.getUTCDay(); // 0=вс..6=сб
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Дата + N дней (N может быть отрицательным) → YYYY-MM-DD. */
export function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(dateIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Intl.toLocaleDateString с одним {month:"short"} отдаёт «стендэлон»-форму
// («июнь» целиком, без сокращения) — расходится с формой при дне+месяце
// («23 июн.»). Не полагаемся на квирк ICU, берём короткие имена сами.
const MONTHS_SHORT = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

function shortMonth(d: Date): string {
  return MONTHS_SHORT[d.getUTCMonth()];
}

/** «23–29 июн» (пн–вс недели); при переходе через месяц — «29 июн – 5 июл». */
export function weekRangeLabel(mondayIso: string): string {
  const monday = new Date(mondayIso + "T00:00:00Z");
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const dFrom = monday.getUTCDate();
  const dTo = sunday.getUTCDate();
  const mFrom = shortMonth(monday);
  const mTo = shortMonth(sunday);
  return mFrom === mTo ? `${dFrom}–${dTo} ${mTo}` : `${dFrom} ${mFrom} – ${dTo} ${mTo}`;
}

/** Компактная метка недели для подписи под столбиком: «23 июн» (дата понедельника). */
export function weekShortLabel(mondayIso: string): string {
  const monday = new Date(mondayIso + "T00:00:00Z");
  return `${monday.getUTCDate()} ${shortMonth(monday)}`;
}
