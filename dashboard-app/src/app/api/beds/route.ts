import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { VAULT_PATH } from "@/lib/vault";
import { getBeds } from "@/lib/beds";
import { toSlug } from "@/lib/slug";
import { gitPersist } from "@/lib/gitPersist";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { name?: string; type?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name обязателен" }, { status: 400 });
  }

  const type = body.type === "user" ? "user" : "agent";

  // Слаг: либо задан явно (id), либо из имени
  const rawSlug = body.id ? String(body.id).trim() : toSlug(name);
  if (!rawSlug) {
    return NextResponse.json({ error: "не удалось сгенерировать slug из name" }, { status: 400 });
  }
  // Защита от path-traversal: slug — только буквы/цифры/дефис/подчёркивание
  if (!/^[a-z0-9_-]+$/i.test(rawSlug)) {
    return NextResponse.json({ error: "недопустимый id грядки" }, { status: 400 });
  }

  // Проверить уникальность — среди уже существующих beds
  const existing = getBeds();
  if (existing.some((b) => b.id === rawSlug)) {
    return NextResponse.json(
      { error: `грядка с id "${rawSlug}" уже существует` },
      { status: 409 }
    );
  }

  const bedsRoot = path.join(VAULT_PATH, "beds");
  const bedDir = path.join(bedsRoot, rawSlug);

  if (fs.existsSync(bedDir)) {
    return NextResponse.json(
      { error: `директория beds/${rawSlug} уже существует` },
      { status: 409 }
    );
  }

  // Создать структуру
  const projectsDir = path.join(bedDir, "projects");
  const inboxDir = path.join(bedDir, "_inbox");
  const bedJsonPath = path.join(bedDir, "bed.json");
  const projectsKeepPath = path.join(projectsDir, ".gitkeep");
  const inboxKeepPath = path.join(inboxDir, ".gitkeep");

  try {
    fs.mkdirSync(projectsDir, { recursive: true });
    fs.mkdirSync(inboxDir, { recursive: true });

    const bedJson = JSON.stringify({ id: rawSlug, name, type }, null, 2) + "\n";
    fs.writeFileSync(bedJsonPath, bedJson, "utf8");
    // git не отслеживает пустые папки — добавляем маркеры
    fs.writeFileSync(projectsKeepPath, "", "utf8");
    fs.writeFileSync(inboxKeepPath, "", "utf8");
  } catch (e) {
    return NextResponse.json({ error: `ошибка создания директории: ${String(e)}` }, { status: 500 });
  }

  gitPersist(
    [
      path.relative(VAULT_PATH, bedJsonPath),
      path.relative(VAULT_PATH, projectsKeepPath),
      path.relative(VAULT_PATH, inboxKeepPath),
    ],
    `beds: create ${rawSlug}`
  );

  return NextResponse.json({ ok: true, id: rawSlug, name, type });
}

/** Переименовать грядку: меняем только `name` в bed.json (id/slug/папка неизменны). */
export async function PATCH(req: Request) {
  let body: { id?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const id = (body.id ?? "").trim();
  const name = (body.name ?? "").trim();
  if (!id) return NextResponse.json({ error: "id обязателен" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "name обязателен" }, { status: 400 });

  const bed = getBeds().find((b) => b.id === id);
  if (!bed) return NextResponse.json({ error: `грядка "${id}" не найдена` }, { status: 404 });

  // bed.json: у дефолтной — в корне vault, у прочих — beds/<id>/bed.json
  const bedJsonPath = bed.isDefault
    ? path.join(VAULT_PATH, "bed.json")
    : path.join(VAULT_PATH, "beds", id, "bed.json");

  try {
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(fs.readFileSync(bedJsonPath, "utf8"));
    } catch {
      data = { id: bed.id, type: bed.type };
    }
    data.name = name;
    fs.writeFileSync(bedJsonPath, JSON.stringify(data, null, 2) + "\n", "utf8");
    gitPersist([path.relative(VAULT_PATH, bedJsonPath)], `beds: rename ${id} → ${name}`);
  } catch (e) {
    return NextResponse.json({ error: `ошибка записи: ${String(e)}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, name });
}
