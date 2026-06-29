"use client";

import { usePathname, useSearchParams } from "next/navigation";
import BedMenu from "./BedMenu";
import BedLink from "./BedLink";
import type { Bed } from "@/lib/beds";

const MAIN_LINKS = [
  { href: "/", label: "Проекты" },
  { href: "/kanban", label: "Канбан" },
  { href: "/rice", label: "RICE" },
  { href: "/analytics", label: "Аналитика" },
];

const RIGHT_LINKS = [{ href: "/help", label: "Справка" }];

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <BedLink
      href={href}
      className={`rounded-md px-3 py-1.5 text-sm transition ${
        active
          ? "bg-neutral-100 font-medium text-neutral-900"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
      }`}
    >
      {label}
    </BedLink>
  );
}

function InboxIcon({ reviewCount }: { reviewCount: number }) {
  const pathname = usePathname();
  const active = pathname.startsWith("/inbox");
  return (
    <BedLink
      href="/inbox"
      aria-label={`Инбокс${reviewCount > 0 ? `, ${reviewCount} ждут апрува` : ""}`}
      className={`relative rounded-md p-1.5 transition ${
        active
          ? "bg-neutral-100 text-neutral-900"
          : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
      }`}
    >
      {/* Envelope SVG */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 7l8 5 8-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      {reviewCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-violet-500 px-0.5 text-[9px] font-bold leading-none text-white">
          {reviewCount}
        </span>
      )}
    </BedLink>
  );
}

export default function Nav({
  reviewCount = 0,
  beds = [],
  activeBedId = "work",
}: {
  reviewCount?: number;
  beds?: Bed[];
  activeBedId?: string;
}) {
  // Активная грядка (per-tab: ?bed → cookie-дефолт)
  const urlBed = useSearchParams().get("bed");
  const currentBedId = urlBed ?? activeBedId;
  void currentBedId; // used by BedMenu via prop

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-3 sm:gap-4">
        <BedLink href="/" className="mr-2 flex items-center gap-2 font-semibold">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-[color:var(--color-accent)] text-xs font-bold text-white">
            A
          </span>
          <span className="hidden sm:inline">Огород</span>
        </BedLink>
        {/* Десктоп: полная навигация в шапке */}
        <nav className="hidden min-w-0 flex-1 items-center gap-1 lg:flex">
          <div className="flex min-w-0 items-center gap-1">
            {MAIN_LINKS.map((l) => (
              <NavLink key={l.href} href={l.href} label={l.label} />
            ))}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <InboxIcon reviewCount={reviewCount} />
            {beds.length > 0 && <BedMenu beds={beds} activeBedId={activeBedId} />}
            {RIGHT_LINKS.map((l) => (
              <NavLink key={l.href} href={l.href} label={l.label} />
            ))}
          </div>
        </nav>
        {/* Мобила: шапка схлопнута до логотипа + переключатель + Справки; навигация — нижний бар */}
        <div className="ml-auto flex items-center gap-1 lg:hidden">
          {beds.length > 0 && <BedMenu beds={beds} activeBedId={activeBedId} />}
          {RIGHT_LINKS.map((l) => (
            <NavLink key={l.href} href={l.href} label={l.label} />
          ))}
        </div>
      </div>
    </header>
  );
}
