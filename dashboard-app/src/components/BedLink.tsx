"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ComponentPropsWithoutRef } from "react";

type BedLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, "href"> & {
  href: string;
};

/**
 * Link, который прокидывает текущий ?bed из URL в новый href.
 * Если bed не задан в URL — ничего не добавляет (дефолтная грядка без параметра).
 */
export default function BedLink({ href, children, className, ...rest }: BedLinkProps) {
  const sp = useSearchParams();
  const bed = sp.get("bed");
  let h = href;
  if (bed) {
    h += (href.includes("?") ? "&" : "?") + "bed=" + encodeURIComponent(bed);
  }
  return (
    <Link href={h} className={className} {...rest}>
      {children}
    </Link>
  );
}
