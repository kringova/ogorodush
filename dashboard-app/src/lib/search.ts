import { TICKET_PREFIX } from "./config";

/**
 * Общая утилита матчинга задач по строке запроса.
 * Переиспользуется в SearchClient и KanbanFilterBar (не дублируем логику).
 *
 * @param haystack  предпосчитанная lowercase-строка поля поиска задачи
 * @param q         пользовательский запрос (произвольный регистр)
 * @returns true, если все токены запроса входят в haystack
 */
export function matchesQuery(haystack: string, q: string): boolean {
  if (!q.trim()) return true;
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.every((tok) => haystack.includes(tok));
}

/**
 * Построить haystack-строку для задачи канбана.
 * Формат совпадает с тем, что строит SearchPage для SearchClient.
 */
export function buildHaystack(fields: {
  id: number;
  summary: string;
  title: string;
  project: string;
  status: string;
  tags: string[];
  body: string;
}): string {
  const ticket = `${TICKET_PREFIX}-${String(fields.id).padStart(4, "0")}`;
  return [
    ticket,
    String(fields.id),
    fields.summary,
    fields.title,
    fields.project,
    fields.status,
    fields.tags.join(" "),
    fields.body,
  ]
    .join(" ")
    .toLowerCase();
}
