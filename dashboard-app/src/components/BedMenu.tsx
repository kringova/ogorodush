"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import BedLink from "./BedLink";
import type { Bed } from "@/lib/beds";

const BED_COOKIE = "ogorod_bed";

const TYPE_LABEL: Record<string, string> = { agent: "агент", user: "человек" };
const TYPE_CLASS: Record<string, string> = {
  agent: "bg-violet-100 text-violet-700",
  user: "bg-sky-100 text-sky-700",
};

/** «Грядки» в навбаре — дропдаун: переключение активной грядки + ссылка на управление. */
export default function BedMenu({
  beds,
  activeBedId,
}: {
  beds: Bed[];
  activeBedId: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Активная грядка: из URL-параметра, иначе из cookie (пришёл из layout)
  const urlBed = sp.get("bed");
  const currentId = urlBed ?? activeBedId;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function switchBed(id: string) {
    if (id === currentId) {
      setOpen(false);
      return;
    }
    // Обновляем cookie как «последняя выбранная» (дефолт для новых вкладок)
    document.cookie = `${BED_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    // Навигация с заменой ?bed в текущем URL (таб сохраняет грядку в URL)
    const params = new URLSearchParams(Array.from(sp.entries()));
    params.set("bed", id);
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
    setOpen(false);
  }

  const active = beds.find((b) => b.id === currentId);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${
          open
            ? "bg-neutral-100 text-neutral-900"
            : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
        }`}
      >
        <span>Грядки</span>
        {active && (
          <span className="hidden text-neutral-400 sm:inline">· {active.name}</span>
        )}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden className="text-neutral-400">
          <path d="M2.5 4l2.5 2.5L7.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-60 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
        >
          <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
            Грядки
          </p>
          {beds.map((bed) => {
            const isActive = bed.id === currentId;
            return (
              <button
                key={bed.id}
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => switchBed(bed.id)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition hover:bg-neutral-50 ${
                  isActive ? "text-neutral-900" : "text-neutral-600"
                }`}
              >
                <span className="w-3.5 shrink-0 text-[color:var(--color-accent)]">
                  {isActive ? "✓" : ""}
                </span>
                <span className="min-w-0 flex-1 truncate">{bed.name}</span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_CLASS[bed.type] ?? TYPE_CLASS.agent}`}
                >
                  {TYPE_LABEL[bed.type] ?? bed.type}
                </span>
              </button>
            );
          })}
          <div className="my-1 border-t border-neutral-100" />
          <BedLink
            href="/beds"
            onClick={() => setOpen(false)}
            className="block px-3 py-1.5 text-sm text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-800"
            role="menuitem"
          >
            Управление грядками →
          </BedLink>
        </div>
      )}
    </div>
  );
}
