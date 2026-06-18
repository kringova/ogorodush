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

human_name="$(git config user.name || true)"
human_email="$(git config user.email || true)"

# Собираем аргументы трейлеров (bash 3.2-safe: пустой массив разворачиваем через guard)
trailer_args=()
if [ -n "$human_name" ] && [ -n "$human_email" ]; then
  trailer_args+=(--trailer "Co-authored-by: ${human_name} <${human_email}>")
fi
if [ -n "$AGENT_MODEL" ]; then
  trailer_args+=(--trailer "Co-authored-by: ${AGENT_MODEL}")
fi

exec git commit --author="$AGENT_AUTHOR" ${trailer_args[@]+"${trailer_args[@]}"} "$@"
