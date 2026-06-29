import { cookies } from "next/headers";
import { getBeds, getActiveBed, type Bed } from "./beds";

export const BED_COOKIE = "ogorod_bed";

/**
 * Читает активную грядку из cookie на сервере.
 * Безопасный фолбэк: если cookie нет или id не найден — дефолтная грядка (корень vault).
 * Вызывать только из Server Components / Route Handlers (Next.js cookies() API).
 */
export async function getActiveBedFromCookie(): Promise<Bed> {
  try {
    const cookieStore = await cookies();
    const activeId = cookieStore.get(BED_COOKIE)?.value;
    return getActiveBed(activeId);
  } catch {
    // Если cookies() недоступен (статическая страница и пр.) — безопасный фолбэк
    return getActiveBed();
  }
}

/**
 * Резолвит активную грядку: сначала по ?bed из URL, затем по cookie→root.
 * Неизвестный ?bed → безопасный фолбэк на cookie→root (не падает).
 */
export async function resolveActiveBed(paramBed?: string): Promise<Bed> {
  const beds = getBeds();
  if (paramBed) {
    const hit = beds.find((b) => b.id === paramBed);
    if (hit) return hit;
  }
  return getActiveBedFromCookie();
}
