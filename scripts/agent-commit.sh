#!/usr/bin/env bash
# agent-commit.sh — коммит от имени агента; человек (из git config) — соавтор.
#
# Зачем: канон атрибуции — автор коммита = агент (он писал код под ревью),
# человек = Co-authored-by. Скрипт собирает это сам, чтобы не набивать
# --author и трейлеры руками на каждом коммите (меньше ошибок и токенов).
#
# Использование (из корня репо):
#   agent-commit.sh -m "сообщение"            # как обычный git commit
#   agent-commit.sh -m "msg" -- path1 path2   # любые флаги git commit проходят насквозь
#
# Настройка через env (опц.):
#   AGENT_AUTHOR  — "Имя <email>" автора-агента (default ниже)
#   AGENT_MODEL   — строка соавтора-модели; пусто → не добавлять
#
# Человек берётся из `git config user.name`/`user.email` текущего репо.

set -eo pipefail

AGENT_AUTHOR="${AGENT_AUTHOR:-Claude (agent) <agent@llmush>}"
AGENT_MODEL="${AGENT_MODEL-Claude Opus 4.8 (1M context) <noreply@anthropic.com>}"

# Человек = эффективная личность коммиттера (git var работает и из git config,
# и из env GIT_COMMITTER_* — config бывает пуст, а личность приходит из окружения).
# Формат git var: "Имя <email> <unixtime> <tz>" — отрезаем хвост времени.
human="$(git var GIT_COMMITTER_IDENT 2>/dev/null | sed -E 's/ [0-9]+ [-+][0-9]+$//')"

# Собираем аргументы трейлеров (bash 3.2-safe: пустой массив разворачиваем через guard)
trailer_args=()
# человека добавляем, если он определился и это не сам агент-автор
if [ -n "$human" ] && [ "$human" != "$AGENT_AUTHOR" ]; then
  trailer_args+=(--trailer "Co-authored-by: ${human}")
fi
if [ -n "$AGENT_MODEL" ]; then
  trailer_args+=(--trailer "Co-authored-by: ${AGENT_MODEL}")
fi

exec git commit --author="$AGENT_AUTHOR" ${trailer_args[@]+"${trailer_args[@]}"} "$@"
