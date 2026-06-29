import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { BottomNav } from "@/components/BottomNav";
import { getAllTasks } from "@/lib/vault";
import { getBeds } from "@/lib/beds";
import { getActiveBedFromCookie } from "@/lib/activeBed";

export const metadata: Metadata = {
  title: "Огород",
  description: "Проекты, задачи и приоритеты из vault Огорода",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const reviewCount = getAllTasks().filter((t) => t.status === "review").length;
  const beds = getBeds();
  const activeBed = await getActiveBedFromCookie();
  return (
    <html lang="ru">
      <body className="overflow-x-clip">
        <Nav reviewCount={reviewCount} beds={beds} activeBedId={activeBed.id} />
        {/* нижний отступ на мобиле — чтобы контент не прятался за фиксированным BottomNav */}
        <main className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:py-8 lg:pb-8">{children}</main>
        <BottomNav reviewCount={reviewCount} />
      </body>
    </html>
  );
}
