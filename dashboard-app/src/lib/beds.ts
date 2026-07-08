import fs from "node:fs";
import path from "node:path";
import { VAULT_PATH } from "./vault";

export interface Bed {
  id: string;
  name: string;
  type: "agent" | "user";
  isDefault: boolean;
  projectsDir: string;
  inboxDir: string;
  digestsDir: string;
}

function readBedJson(filePath: string): { id: string; name: string; type: "agent" | "user" } | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    if (!data.id || !data.name) return null;
    return {
      id: String(data.id),
      name: String(data.name),
      type: data.type === "user" ? "user" : "agent",
    };
  } catch {
    return null;
  }
}

/**
 * Обнаруживает все грядки в vault:
 * 1. Корневая грядка — VAULT_PATH/bed.json → isDefault=true, projectsDir = VAULT_PATH/projects
 * 2. Дополнительные — VAULT_PATH/beds/<slug>/bed.json → projectsDir = VAULT_PATH/beds/<slug>/projects
 *
 * Если корневого bed.json нет — синтезируем дефолтный bed {id:"work",name:"Рабочая",type:"agent"}.
 */
export function getBeds(): Bed[] {
  const beds: Bed[] = [];

  // Корневая (дефолтная) грядка
  const rootBedFile = path.join(VAULT_PATH, "bed.json");
  const rootBedData = readBedJson(rootBedFile) ?? { id: "work", name: "Рабочая", type: "agent" as const };
  beds.push({
    ...rootBedData,
    isDefault: true,
    projectsDir: path.join(VAULT_PATH, "projects"),
    inboxDir: path.join(VAULT_PATH, "_inbox"),
    digestsDir: path.join(VAULT_PATH, "digests"),
  });

  // Дополнительные грядки — VAULT_PATH/beds/*/bed.json
  const bedsRoot = path.join(VAULT_PATH, "beds");
  if (fs.existsSync(bedsRoot)) {
    let entries: string[];
    try {
      entries = fs.readdirSync(bedsRoot);
    } catch {
      entries = [];
    }
    for (const slug of entries) {
      const bedDir = path.join(bedsRoot, slug);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(bedDir);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;
      const bedFile = path.join(bedDir, "bed.json");
      const bedData = readBedJson(bedFile);
      if (!bedData) continue;
      beds.push({
        ...bedData,
        isDefault: false,
        projectsDir: path.join(bedDir, "projects"),
        inboxDir: path.join(bedDir, "_inbox"),
        digestsDir: path.join(bedDir, "digests"),
      });
    }
  }

  return beds;
}

/**
 * Вернуть грядку по id, или дефолтную.
 * Никогда не бросает — безопасный фолбэк на корень.
 */
export function getActiveBed(activeId?: string): Bed {
  const beds = getBeds();
  const defaultBed = beds.find((b) => b.isDefault) ?? beds[0];
  if (!activeId) return defaultBed;
  return beds.find((b) => b.id === activeId) ?? defaultBed;
}
