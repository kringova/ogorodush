#!/usr/bin/env python3
"""Гейт объёма коммита (Артель): ловит git add -A, сметающий несвязанные правки.

Класс ошибки (_lessons 2026-06-14/15/17, повтор x3): `git add -A` затягивает в
коммит файлы вне объёма задачи — чужие/фоновые правки, чаще из другого проекта.
Сигнатура свипа: staged-файлы затрагивают >=2 разных projects/<slug>/ (контаминация
между проектами) либо build-артефакты, не предназначенные для коммита.

Блокирует такой коммит. Намеренный мультипроектный коммит (напр. разбор инбокса) —
с явным GIT_SCOPE_OK=1. Апрув-сервис (LLMUSH_APPROVE=1) пропускается.

Honest-ограничение: коммитит агент, поэтому это гейт + аудит-след, а не
криптостойкость. Истинный корень (два процесса в одном рабочем дереве) лечится
отдельным git-worktree для фонового агента — см. задачу #302/заметки.

Запуск: как часть git pre-commit hook.
"""
from __future__ import annotations

import os
import re
import subprocess
import sys

if any(
    os.environ.get(v) == "1"
    for v in ("GIT_SCOPE_OK", "LLMUSH_APPROVE", "ARTEL_APPROVE")
):
    sys.exit(0)


def git(args: list[str]) -> str:
    return subprocess.run(["git", *args], capture_output=True, text=True).stdout


staged = [l for l in git(["diff", "--cached", "--name-only"]).splitlines() if l.strip()]
if not staged:
    sys.exit(0)

PROJECT_RE = re.compile(r"^projects/([^/]+)/")
ARTIFACT_RE = re.compile(r"(^|/)(node_modules|\.next|dist|build)/|\.tsbuildinfo$")

projects = sorted({m.group(1) for f in staged if (m := PROJECT_RE.match(f))})
artifacts = [f for f in staged if ARTIFACT_RE.search(f)]

problems: list[str] = []
if len(projects) >= 2:
    problems.append(
        f"коммит затрагивает {len(projects)} проекта ({', '.join(projects)}) — "
        f"похоже на git add -A, сметающий чужое"
    )
if artifacts:
    shown = ", ".join(artifacts[:5])
    problems.append(f"build-артефакты в индексе: {shown}")

if problems:
    print("ГЕЙТ ОБЪЁМА КОММИТА (scope guard) — заблокировано:", file=sys.stderr)
    for p in problems:
        print(f"  * {p}", file=sys.stderr)
    print("\nStaged-файлы:", file=sys.stderr)
    for f in staged:
        print(f"    {f}", file=sys.stderr)
    print("\nКоммить явными путями: git add <пути>, не `git add -A`.", file=sys.stderr)
    print("Если мультипроектный коммит намеренный (напр. разбор инбокса):", file=sys.stderr)
    print("    GIT_SCOPE_OK=1 git commit ...", file=sys.stderr)
    sys.exit(1)

sys.exit(0)
