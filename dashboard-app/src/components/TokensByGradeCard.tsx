"use client";

/**
 * Переключаемый виджет «Токены по грейдам и моделям».
 * Два таба: «сегодня» / «за всё время». Дефолт — «сегодня».
 */

import { useState } from "react";
import GradeBadge from "@/components/GradeBadge";

const TIERS_DESC = ["senior", "middle", "junior"] as const;
const TIER_COLOR: Record<string, string> = {
  junior: "bg-lime-400",
  middle: "bg-sky-400",
  senior: "bg-violet-400",
  unknown: "bg-neutral-400",
};

type Bucket = { io: number; cache: number };
type GradeBucket = Bucket & { models: Record<string, Bucket> };

export interface TokensDataset {
  grades: Record<string, GradeBucket>;
  totalIo: number;
}

interface Props {
  today: TokensDataset;
  allTime: TokensDataset;
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString("ru-RU");
}

export default function TokensByGradeCard({ today, allTime }: Props) {
  const [tab, setTab] = useState<"today" | "allTime">("today");
  const dataset = tab === "today" ? today : allTime;
  const { grades, totalIo } = dataset;

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Токены по грейдам и моделям
          </h2>
          <p className="mt-1 text-xs text-neutral-400">
            кто реально жёг токены — грейд по фактической модели (каталог scripts/model-grades.json; вне каталога → unknown)
          </p>
        </div>
        {/* Переключатель */}
        <div className="flex shrink-0 rounded-lg border border-neutral-200 overflow-hidden text-xs">
          <button
            onClick={() => setTab("today")}
            className={`px-3 py-1.5 font-medium transition-colors ${
              tab === "today"
                ? "bg-neutral-900 text-white"
                : "bg-white text-neutral-500 hover:bg-neutral-50"
            }`}
          >
            сегодня
          </button>
          <button
            onClick={() => setTab("allTime")}
            className={`px-3 py-1.5 font-medium transition-colors border-l border-neutral-200 ${
              tab === "allTime"
                ? "bg-neutral-900 text-white"
                : "bg-white text-neutral-500 hover:bg-neutral-50"
            }`}
          >
            за всё время
          </button>
        </div>
      </div>

      <div className="mt-3">
        {totalIo === 0 || Object.keys(grades).length === 0 ? (
          <p className="text-sm text-neutral-400">
            {tab === "today" ? "сегодня токенов ещё нет" : "нет данных"}
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {/* unknown — только когда есть токены вне каталога: громкая строка, не постоянный шум */}
            {[...((grades.unknown?.io ?? 0) > 0 ? (["unknown"] as const) : []), ...TIERS_DESC].map((grade) => {
              const g = grades[grade];
              const io = g?.io ?? 0;
              const pct = totalIo > 0 ? (io / totalIo) * 100 : 0;
              const used = io > 0;
              return (
                <div key={grade} className={used ? "" : "opacity-50"}>
                  <div className="flex items-center justify-between gap-2">
                    <GradeBadge tier={grade} showLabel size="lg" />
                    <span className="font-mono text-2xl font-semibold tabular-nums text-neutral-800">
                      {pct.toFixed(1)}<span className="text-base text-neutral-400">%</span>
                    </span>
                  </div>
                  <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className={`h-full rounded-full ${TIER_COLOR[grade]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {used ? (
                    <ul className="mt-2.5 flex flex-col gap-1.5">
                      {Object.entries(g.models)
                        .sort((a, b) => b[1].io - a[1].io)
                        .map(([model, m]) => (
                          <li key={model} className="flex items-baseline gap-2 text-xs">
                            <span className="select-none text-neutral-300">╰</span>
                            <span className="min-w-0 truncate font-medium text-neutral-600">{model}</span>
                            <span className="ml-auto shrink-0 font-mono tabular-nums text-neutral-500">
                              {m.io.toLocaleString("ru-RU")} io
                              <span className="text-neutral-300"> · </span>
                              <span className="text-neutral-400">{fmtCompact(m.cache)} cache</span>
                            </span>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="mt-2 pl-4 text-xs text-neutral-400">не использовалась</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
