import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { VAULT_PATH } from "@/lib/vault";
import { getBeds } from "@/lib/beds";
import { getActiveBedFromCookie } from "@/lib/activeBed";
import { gitPersist } from "@/lib/gitPersist";

export const runtime = "nodejs";

const DEFAULT_INBOX_DIR = path.join(VAULT_PATH, "_inbox");

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Локальный штамп вида 2026-06-12-1430 для имени файла. */
function stamp(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}`;
}

export async function POST(req: Request) {
  let body: { text?: string; project?: string; bedId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  const project = (body.project ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "пустая запись" }, { status: 400 });
  }

  // Пишем в инбокс активной грядки.
  // Приоритет: bedId из body → cookie → корень vault.
  const bedId = (body.bedId ?? "").trim();
  let inboxDir: string;
  if (bedId) {
    const bed = getBeds().find((b) => b.id === bedId);
    inboxDir = bed ? bed.inboxDir : DEFAULT_INBOX_DIR;
  } else {
    const activeBed = await getActiveBedFromCookie();
    inboxDir = activeBed.inboxDir;
  }

  fs.mkdirSync(inboxDir, { recursive: true });

  const now = new Date();
  const slug = `${stamp(now)}-${randomUUID().slice(0, 4)}`;
  const file = path.join(inboxDir, `${slug}.md`);

  const frontmatter = [
    "---",
    `created: ${now.toISOString()}`,
    project ? `project: ${project}` : null,
    "tags: [inbox]",
    "---",
    "",
    text,
    "",
  ]
    .filter((l) => l !== null)
    .join("\n");

  fs.writeFileSync(file, frontmatter, "utf8");

  const pushed = gitPersist(
    [path.relative(VAULT_PATH, file)],
    `inbox: ${slug}`
  );

  return NextResponse.json({ ok: true, slug, pushed });
}
