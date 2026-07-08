#!/usr/bin/env bash
# agent-commit.sh — коммит: автор = ИИ (модель), человек = соавтор.
#
# Канон атрибуции (решение пользователя): автор коммита — модель, что писала
# код, человек (ревьюер/мейнтейнер) — Co-authored-by. Committer остаётся
# человеком. Скрипт собирает это сам, чтобы не набивать --author и трейлер
# руками на каждом коммите.
#
# Ровно ДВЕ личности на коммите: модель (автор) + человек (соавтор/коммиттер).
# Никаких дублей-ИИ.
#
# Приватность: личный email и hostname машины НЕ должны попадать в историю
# (для публичных репо это утечка — инцидент 2026-07-08, аудит #440). Поэтому
# личность человека проходит псевдонимизацию: если origin — GitHub, email
# заменяется на <owner>@users.noreply.github.com; committer переписывается
# теми же значениями. Явная личность задаётся env OGOROD_HUMAN и имеет
# приоритет (формат: "Имя <email>").
#
# Использование (из корня репо):
#   agent-commit.sh -m "сообщение"            # как обычный git commit
#   agent-commit.sh -m "msg" path1 path2      # любые флаги git commit проходят насквозь
#
# Настройка через env (опц.):
#   AGENT_AUTHOR  — "Имя <email>" автора-модели (default — текущая модель сессии)
#   OGOROD_HUMAN  — "Имя <email>" человека; выключает автоопределение

set -eo pipefail

AGENT_AUTHOR="${AGENT_AUTHOR:-Claude Opus 4.8 (1M context) <noreply@anthropic.com>}"

# --- Личность человека ---
if [ -n "$OGOROD_HUMAN" ]; then
  human="$OGOROD_HUMAN"
else
  # Эффективная личность коммиттера. Формат git var:
  # "Имя <email> <unixtime> <tz>" — отрезаем хвост времени.
  human="$(git var GIT_COMMITTER_IDENT 2>/dev/null | sed -E 's/ [0-9]+ [-+][0-9]+$//')"
  name="${human% <*}"
  email="$(printf '%s' "$human" | sed -nE 's/.*<([^>]*)>.*/\1/p')"

  # Псевдонимизация: origin на GitHub → noreply-адрес владельца репо.
  # Личный адрес (gmail и т.п.) и авто-identity с hostname машины (*.local)
  # не должны утекать в историю.
  owner="$(git remote get-url origin 2>/dev/null | sed -nE 's#.*github\.com[:/]([^/]+)/.*#\1#p')"
  if [ -n "$owner" ]; then
    case "$email" in
      *users.noreply.github.com|*noreply*) : ;;                # уже безопасный
      *) email="${owner}@users.noreply.github.com" ;;
    esac
    [ -n "$name" ] || name="$owner"
    human="${name} <${email}>"
    # Committer — те же безопасные значения (иначе hostname утечёт в committer-поле)
    export GIT_COMMITTER_NAME="$name"
    export GIT_COMMITTER_EMAIL="$email"
  fi
fi

trailer_args=()
# человека добавляем соавтором, если он определился и это не сам автор
if [ -n "$human" ] && [ "$human" != "$AGENT_AUTHOR" ]; then
  trailer_args+=(--trailer "Co-authored-by: ${human}")
fi

exec git commit --author="$AGENT_AUTHOR" ${trailer_args[@]+"${trailer_args[@]}"} "$@"
