#!/usr/bin/env bash
# agent-commit.sh — коммит: автор = ИИ (модель), человек = соавтор.
#
# Канон атрибуции (решение пользователя): автор коммита — модель, что писала
# код, человек (ревьюер/мейнтейнер) — Co-authored-by. Committer остаётся
# человеком (из окружения). Скрипт собирает это сам, чтобы не набивать
# --author и трейлер руками на каждом коммите.
#
# Ровно ДВЕ личности на коммите: модель (автор) + человек (соавтор/коммиттер).
# Никаких дублей-ИИ.
#
# Использование (из корня репо):
#   agent-commit.sh -m "сообщение"            # как обычный git commit
#   agent-commit.sh -m "msg" path1 path2      # любые флаги git commit проходят насквозь
#
# Настройка через env (опц.):
#   AGENT_AUTHOR  — "Имя <email>" автора-модели (default — текущая модель сессии)
#
# Человек берётся из эффективной личности коммиттера (`git var`), а не из
# `git config user.*` — он бывает пуст, а личность приходит из окружения.

set -eo pipefail

AGENT_AUTHOR="${AGENT_AUTHOR:-Claude Opus 4.8 (1M context) <noreply@anthropic.com>}"

# Человек = эффективная личность коммиттера. Формат git var:
# "Имя <email> <unixtime> <tz>" — отрезаем хвост времени.
human="$(git var GIT_COMMITTER_IDENT 2>/dev/null | sed -E 's/ [0-9]+ [-+][0-9]+$//')"

trailer_args=()
# человека добавляем соавтором, если он определился и это не сам автор
if [ -n "$human" ] && [ "$human" != "$AGENT_AUTHOR" ]; then
  trailer_args+=(--trailer "Co-authored-by: ${human}")
fi

exec git commit --author="$AGENT_AUTHOR" ${trailer_args[@]+"${trailer_args[@]}"} "$@"
