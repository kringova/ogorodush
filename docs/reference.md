<!-- Audience: агент или разработчик, создающий или редактирующий файлы vault
     Purpose: быстро найти структуру директорий и все поля frontmatter задачи/проекта/инбокса -->

# Справочник по структуре

```
AGENTS.md            канонические правила для агента (вендор-нейтрально)
CLAUDE.md            шим @AGENTS.md для Claude Code
ogorod.config.json    выбор дашборда: {"dashboard":"mini"|"full"} (пишет навык setup)
_rules.md            полная методология
_dashboard.md        Dataview-сводка: проекты, беклог по RICE, канбан
_templates/
  task.md            шаблон задачи
  project.md         шаблон карточки проекта
  docs/              шаблоны документов проекта
    brief.md         бриф (RFC): замысел, метрики, фазы — до старта
    architecture.md  архитектура (стек, модули, потоки)
    decisions.md     журнал решений (ADR-lite)
    scenarios.md     сценарии использования → smoke
    README.md · AGENTS.md · CHANGELOG.md
_inbox/              сырые записи «на разбор», по файлу на запись
projects/
  <slug>/
    <slug>.md        карточка проекта
    brief.md         бриф (RFC) — на старте проекта
    roadmap.md       фазы с чекбоксами
    decisions.md     журнал решений (active+)
    scenarios.md     сценарии использования → smoke (active+)
    tasks/
      tasks.md       Dataview-индекс задач проекта
      <имя>.md       задачи
skills/
  setup/SKILL.md     первый запуск vault: онбординг + выбор дашборда (mini/full), пишет ogorod.config.json
  sync/SKILL.md      контекст всех проектов в сессию
  backlog/SKILL.md   завести задачу
  close/SKILL.md     закрыть задачу (done + лог); постфактум-задача
  recap/SKILL.md     итоги за период
  inbox/SKILL.md     разобрать инбокс
  onboard/SKILL.md   brownfield-канон: поднять первичную доку по существующему проекту из артефактов и кода
  charter/SKILL.md   рождение проекта: стартовый набор доки (brief, карточка с jtbd, roadmap) до первой задачи
docs/
  methodology.md     принципы, проекты, задачи, RICE, жизненный цикл
  roles.md           роли команды и их включение по RICE
  workflow.md        жизненный цикл и гейты
  doc-canon.md       канон документации проекта, карта APC
  styleguide.md      как писать доку (APC, против воды)
  reference.md       эта страница — структура и поля
  skills.md · faq.md · installation.md
```

## Frontmatter задачи

```yaml
---
id: 42                      # сквозной номер тикета (max по vault + 1)
project: "[[slug/slug]]"    # wiki-ссылка на карточку проекта
status: todo                # todo | doing | review | done | blocked | cancelled
tags: [task]                # + bug для багов/инцидентов
created: 2026-06-12
created_at: 2026-06-12T10:00:00  # обязательно: ISO datetime создания
updated: 2026-06-12         # обновлять при каждом изменении
closed_at:                  # обязательно при закрытии: ISO datetime закрытия
sp: 3                       # Story Points — размер (Фибоначчи 1/2/3/5/8/13), не время
rice_reach: 5               # 1–10
rice_impact: 3              # 1–5
rice_confidence: 80         # 50–100
rice_effort: 0.6            # sp / 5, минимум 0.1
summary: "Одна строка для индексов"
roles: [reviewer, techwriter]  # опц.: роли, выведенные из RICE-порогов (см. roles.md)
model_tier: middle          # грейд модели по природе задачи (см. methodology.md)
next_up: false              # опц.: запланировано к взятию в работу (true → навык sync берёт в doing)
---
```

Разделы тела: «Что нужно сделать», «Почему важно», «Критерии готовности (DoD)», «Пререквизиты», «Вопросы», «Заметки». Семантика каждого — в [methodology.md](methodology.md).

Поле `roles` — какие роли Огорода включаются на задаче; выводится из компонентов RICE (пороги — в [roles.md](roles.md) и [workflow.md](workflow.md)).

Поле `sp` — размер задачи в Story Points (Фибоначчи), первичная оценка вместо времени; `rice_effort = sp/5`. Поле `model_tier` — грейд модели по природе задачи. Оба — в [methodology.md](methodology.md). Старые задачи могут иметь `est_days` вместо `sp` (переходный период).

Поле `next_up: true/false` — опциональное; при `true` навык `sync` берёт эту задачу в работу (`doing`) в начале сессии.

### Опциональные поля метрики тиринга (заполняет адаптер)

Если адаптер умеет считать токены прогона (см. «Тиринг — адаптер» в [AGENTS.md](../AGENTS.md)), он копит их на задаче. Поля опциональны и вендор-специфичны — ядро методологии на них не завязано; пустые — тиринг-метрика просто недоступна.

```yaml
cost_since: 2026-06-12T10:00:00Z   # курсор: с какого момента считаем дельту токенов
cost_io_tokens: 191265             # суммарно ввод/вывод за задачу
cost_cache_tokens: 78367898        # токены из кэша
cost_by_model: "senior=180140/77086876; middle=11125/1281022"  # io/cache по грейдам
```

Метрика стоимости SP = `cost_*` / `sp` — фактический расход на единицу размера, основа для калибровки грейдов. Как именно поля заполняются — дело адаптера (для Claude Code — скрипт-чекпойнт + хук субагентов).

## Frontmatter проекта

```yaml
---
status: active              # idea | active | paused | done
type: product               # свободная типизация: product, tool, research…
priority: medium            # high | medium | low
tags: [project]
audience: "кто пользуется"
jtbd: "когда я …, хочу …, чтобы …"   # Purpose аудитории одной строкой
repo: "https://github.com/..."
local: "/path/to/code"
updated: 2026-06-12
---
```

## Запись инбокса

```yaml
---
created: 2026-06-12T13:09:13.195Z   # ISO-дата
project: financeush                  # slug; можно опустить — агент определит
tags: [inbox]
---

текст мысли как есть
```

Имя файла любое уникальное, например `2026-06-12-1309-ab12.md`.

## Индекс задач проекта (tasks.md)

Dataview-запрос (готовый — в `projects/example-project/tasks/tasks.md`; при копировании поменяйте путь в `FROM`). Сортировка: активные по убыванию RICE, затем done/cancelled; их RICE отображается как «—».

## Dataview-поля, на которых всё держится

Сводки строятся из frontmatter, поэтому критично: `tags` содержит `project`/`task`, `status` из фиксированного набора, числовые `rice_*` заполнены. Сломанный frontmatter = задача выпала из дашборда.

## Шаблон релизноутс

Структура release notes для публикации в GitHub Release и CHANGELOG.md:

```
### Добавлено
- Что-то новое, которое работает в сторону, не ломая старое

### Изменено
- Что улучшилось в поведении, но обратно совместимо

### Исправлено
- Что починили без влияния на схему или структуру

### Миграция
_(Заполнять только при breaking-изменениях)_

1. **Переименование поля:** `est_days` → `sp` — в frontmatter всех задач замените `est_days: <число>` на `sp: <число>` (если нет `sp`, значение не переносится; оцените вручную).
2. **Структура папок:** переместите `projects/*/` → `projects/<slug>/tasks/`, пересоздайте индексы (`tasks.md`).
3. **Формат конфига:** обновите `ogorod.config.json` по образцу в `_templates/`; запустите навык `setup` для переонбординга.
```

Пример — breaking-релиз с несколькими шагами миграции (конкретные команды, что именно менять в файлах).
