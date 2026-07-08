<!-- Audience: агент / новый разработчик в проекте ogorod-dashboard
     Purpose: за минуту понять команды, структуру и конвенции, чтобы работать без объяснений -->

# AGENTS.md — ogorod-dashboard

Веб-дашборд vault Огорода: читает markdown-файлы (`projects/*`, задачи, RICE) и показывает проекты, канбан, приоритеты, инбокс. Next.js 15 (app router) · React 19 · Tailwind v4 · gray-matter · remark · **без БД**. Корень репозитория = корень проекта.

## Команды

```bash
npm install
npm run dev      # дев-сервер :3000
npm run build    # прод-сборка
npm run start    # прод-режим (next start)
npm run lint
```

Источник данных — vault: путь задаётся env `VAULT_PATH` (путь к корню vault с папкой `projects/`). Без БД: всё читается из md на лету.

## Структура

- `src/lib/` — ядро:
  - `vault.ts` — чтение md vault (проекты, задачи, RICE; типы `Task`/`Project`; `Task.key` = `OGOROD-####`);
  - `markdown.ts` — рендер тел и `[[wiki-ссылок]]`;
  - `git.ts` — даты из git; `ui.ts` — форматтеры (`fmtTicket`, `fmtRice`); `config.ts` — capacity/оценки.
- `src/app/` — роуты: `projects`, `t/[key]` (короткий URL задачи), `kanban`, `rice`, `roadmap`, `burndown`, `search`, `inbox`, `api`.
- `src/components/` — UI.

## Конвенции

- Данных-БД нет — **источник правды это md-файлы vault**; дашборд только читает (кроме инбокса: `POST /api/inbox` → файл в `_inbox/` + commit/push).
- Ссылки на задачу — по `key` (`OGOROD-####`), роут резолвит и по key, и по старому slug (wiki-ссылки целы).
- Деплой и прод — **см. [README.md](README.md)** (runbook, точка истины, не гадать).

## Документация

[README](README.md) · [CHANGELOG.md](CHANGELOG.md)
