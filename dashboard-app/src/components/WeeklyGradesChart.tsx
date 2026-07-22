"use client";

/**
 * SVG-график «Грейды по неделям»: вертикальные 100%-стековые столбики доли
 * io-токенов по грейду фактической модели, по ISO-неделям даты закрытия.
 * Порядок сегментов фиксирован: junior снизу, middle, senior сверху.
 * Недели без измеренных задач не рисуются — сжатая ось.
 * Опциональная аннотация: пунктирная линия на дату `gateDate` (например,
 * дата включения тиринга/делегирования в конкретном vault) — задаётся
 * пропом, без дефолта, т.к. дата специфична для проекта.
 */

import { useRef, useState, useCallback } from "react";
import type { WeeklyGradePoint } from "@/lib/grade";
import { mondayOf, weekShortLabel } from "@/lib/weeks";

interface Props {
  weeks: WeeklyGradePoint[];
  /** ISO-дата (YYYY-MM-DD) для вертикальной аннотации; без пропа — линия не рисуется. */
  gateDate?: string;
  /** Подпись у аннотации. */
  gateLabel?: string;
}

const W = 820;
const H = 280;
// t с запасом под подпись аннотации над столбиками — не наезжает на 100%-сегмент.
const PAD = { l: 16, r: 16, t: 38, b: 48 };
const chartW = W - PAD.l - PAD.r;
const chartH = H - PAD.t - PAD.b;
const GAP = 2;
const RADIUS = 4;

// unknown — модель вне каталога model-grades.json: серым и громко, не выбрасываем (#490)
const COLOR = { junior: "#10b981", middle: "#f59e0b", senior: "#8b5cf6", unknown: "#9ca3af" } as const;
const ORDER = ["junior", "middle", "senior", "unknown"] as const; // порядок стека снизу вверх
const LABEL = { junior: "junior", middle: "middle", senior: "senior", unknown: "unknown" } as const;

function xOf(i: number, n: number): number {
  const slot = chartW / n;
  return PAD.l + slot * (i + 0.5);
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}

function pluralTasks(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "задача";
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return "задачи";
  return "задач";
}

/** x аннотации: точное совпадение недели или интерполяция между соседними активными неделями. */
function gateX(weeks: WeeklyGradePoint[], n: number, gateDate: string): number | null {
  const gateMonday = mondayOf(gateDate);
  const idx = weeks.findIndex((w) => w.weekStart === gateMonday);
  if (idx >= 0) return xOf(idx, n);
  let prevIdx = -1;
  let nextIdx = -1;
  for (let i = 0; i < n; i++) {
    if (weeks[i].weekStart < gateMonday) prevIdx = i;
    if (weeks[i].weekStart > gateMonday && nextIdx === -1) nextIdx = i;
  }
  if (prevIdx === -1 && nextIdx === -1) return null;
  if (prevIdx === -1) return xOf(nextIdx, n);
  if (nextIdx === -1) return xOf(prevIdx, n);
  const prevMs = Date.parse(weeks[prevIdx].weekStart);
  const nextMs = Date.parse(weeks[nextIdx].weekStart);
  const gateMs = Date.parse(gateMonday);
  const frac = (gateMs - prevMs) / (nextMs - prevMs);
  return xOf(prevIdx, n) + frac * (xOf(nextIdx, n) - xOf(prevIdx, n));
}

export default function WeeklyGradesChart({ weeks, gateDate, gateLabel = "аннотация" }: Props) {
  const n = weeks.length;

  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg || n === 0) return;
      const bbox = svg.getBoundingClientRect();
      const scale = W / bbox.width;
      const svgX = (e.clientX - bbox.left) * scale;
      let best = 0;
      let bestDist = Math.abs(xOf(0, n) - svgX);
      for (let i = 1; i < n; i++) {
        const d = Math.abs(xOf(i, n) - svgX);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      setHoverIdx(best);
      const rawX = xOf(best, n) / scale;
      const tipW = 200;
      const tipH = 130;
      const clampedX = Math.min(Math.max(rawX + 12, 4), bbox.width - tipW - 4);
      const clampedY = Math.max(Math.min(e.clientY - bbox.top - tipH / 2, bbox.height - tipH - 4), 4);
      setTooltipPos({ x: clampedX, y: clampedY });
    },
    [n]
  );

  const handleMouseLeave = useCallback(() => setHoverIdx(null), []);

  if (n === 0) {
    return (
      <p className="text-sm text-neutral-400">копится — нужна хотя бы одна неделя с закрытыми измеренными задачами</p>
    );
  }

  const slotW = chartW / n;
  const barW = Math.min(56, Math.max(8, slotW - 4));
  const yBottom = H - PAD.b;
  const usableH = chartH - GAP * 2;
  const gx = gateDate ? gateX(weeks, n, gateDate) : null;

  const hw = hoverIdx !== null ? weeks[hoverIdx] : null;

  return (
    <div>
      <div className="relative w-full" style={{ userSelect: "none" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ maxHeight: H }}
          preserveAspectRatio="xMidYMid meet"
          aria-label="Грейды по неделям: доля io-токенов по грейду фактической модели"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {weeks.map((w, i) => {
            const cx = xOf(i, n);
            const xL = cx - barW / 2;
            // сегменты снизу вверх по ORDER; верхний рисуется со скруглением
            const segs: { grade: (typeof ORDER)[number]; top: number; h: number }[] = [];
            let bottom = yBottom;
            for (const g of ORDER) {
              const h = ((w.pct[g] ?? 0) / 100) * usableH;
              if (h > 0.5) {
                segs.push({ grade: g, top: bottom - h, h });
                bottom -= h + GAP;
              }
            }

            const segLabel = (pct: number, y: number, h: number) =>
              pct >= 15 && h > 1 ? (
                <text
                  x={cx}
                  y={y + h / 2 + 4}
                  fontSize={11}
                  fontWeight={700}
                  textAnchor="middle"
                  fill="white"
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {Math.round(pct)}%
                </text>
              ) : null;

            return (
              <g key={w.weekStart}>
                {segs.map((s, si) =>
                  si === segs.length - 1 ? (
                    /* верхний сегмент — скругление 4px только сверху */
                    <path
                      key={s.grade}
                      d={`M ${xL},${s.top + s.h} L ${xL},${s.top + RADIUS} Q ${xL},${s.top} ${xL + RADIUS},${s.top} L ${xL + barW - RADIUS},${s.top} Q ${xL + barW},${s.top} ${xL + barW},${s.top + RADIUS} L ${xL + barW},${s.top + s.h} Z`}
                      fill={COLOR[s.grade]}
                    />
                  ) : (
                    <rect key={s.grade} x={xL} y={s.top} width={barW} height={s.h} fill={COLOR[s.grade]} />
                  )
                )}

                {segs.map((s) => (
                  <g key={`l-${s.grade}`}>{segLabel(w.pct[s.grade] ?? 0, s.top, s.h)}</g>
                ))}

                {/* подпись под столбиком: неделя + абсолют io */}
                <text x={cx} y={yBottom + 16} fontSize={10} fill="#a3a3a3" textAnchor="middle">
                  {weekShortLabel(w.weekStart)}
                </text>
                <text x={cx} y={yBottom + 29} fontSize={10} fill="#d4d4d4" textAnchor="middle" fontFamily="monospace">
                  {fmtCompact(w.totalIo)}
                </text>
              </g>
            );
          })}

          {/* аннотация — подпись в верхнем поле, не поверх столбиков */}
          {gx !== null && (
            <g>
              <line
                x1={gx}
                y1={PAD.t - 6}
                x2={gx}
                y2={yBottom}
                stroke="#9ca3af"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={gx + (gx + 92 > W - PAD.r ? -4 : 4)}
                y={PAD.t - 12}
                fontSize={9}
                fill="#9ca3af"
                textAnchor={gx + 92 > W - PAD.r ? "end" : "start"}
              >
                {gateLabel}
              </text>
            </g>
          )}

          {/* ховер: вертикальная направляющая */}
          {hoverIdx !== null && (
            <line
              x1={xOf(hoverIdx, n)}
              y1={PAD.t}
              x2={xOf(hoverIdx, n)}
              y2={yBottom}
              stroke="#6b7280"
              strokeWidth={1}
              strokeDasharray="4 3"
              strokeLinecap="round"
              opacity={0.35}
            />
          )}
        </svg>

        {hoverIdx !== null && hw && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-lg"
            style={{ left: tooltipPos.x, top: tooltipPos.y, minWidth: "190px" }}
          >
            <p className="mb-1 text-xs font-semibold text-neutral-600">неделя {weekShortLabel(hw.weekStart)}</p>
            <div className="flex flex-col gap-0.5 text-xs">
              {[...ORDER]
                .reverse()
                .filter((g) => g !== "unknown" || (hw.io.unknown ?? 0) > 0)
                .map((g) => (
                  <span key={g} className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLOR[g] }} />
                    <span className="text-neutral-500">{LABEL[g]}</span>
                    <span className="ml-auto font-mono font-semibold text-neutral-700">
                      {(hw.io[g] ?? 0).toLocaleString("ru-RU")} io · {Math.round(hw.pct[g] ?? 0)}%
                    </span>
                  </span>
                ))}
              <span className="mt-0.5 text-neutral-400">
                {hw.totalIo.toLocaleString("ru-RU")} io всего · {hw.count} {pluralTasks(hw.count)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-2 flex gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLOR.senior }} />
          senior
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLOR.middle }} />
          middle
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLOR.junior }} />
          junior
        </span>
        {weeks.some((w) => (w.io.unknown ?? 0) > 0) && (
          <span className="flex items-center gap-1" title="модель вне каталога model-grades.json">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLOR.unknown }} />
            unknown
          </span>
        )}
        <span className="ml-auto text-neutral-400">
          {n} {n === 1 ? "неделя" : n < 5 ? "недели" : "недель"} с закрытыми измеренными задачами
        </span>
      </div>
    </div>
  );
}
