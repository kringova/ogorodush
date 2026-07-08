"use client";

/**
 * SVG-график «Поток по неделям»: сколько SP заведено (вверх) и закрыто (вниз)
 * вокруг нулевой базовой линии, по ISO-неделям. Один столбик на неделю —
 * верхняя половина (заведено, синяя) и нижняя половина (закрыто, зелёная)
 * растут от общей базовой линии; на уровне нетто (заведено−закрыто) —
 * засечка с числом (только у экстремумов и текущей недели).
 * Текущая (неполная) неделя — приглушённая, в пунктирной рамке.
 */

import { useRef, useState, useCallback } from "react";
import type { WeeklyFlowPoint } from "@/lib/vault";

interface Props {
  weeks: WeeklyFlowPoint[];
}

const W = 820;
const H = 260;
const PAD = { l: 16, r: 16, t: 26, b: 40 };
const chartW = W - PAD.l - PAD.r;
const chartH = H - PAD.t - PAD.b;
const yBase = PAD.t + chartH / 2;
const halfH = chartH / 2 - 16; // запас сверху/снизу под подписи экстремумов

const CREATED_COLOR = "#3b82f6";
const CLOSED_COLOR = "#10b981";
const RADIUS = 4;

function xOf(i: number, n: number): number {
  const slot = chartW / n;
  return PAD.l + slot * (i + 0.5);
}

function pluralTasks(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "задача";
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return "задачи";
  return "задач";
}

function fmtSigned(v: number): string {
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? "+" : ""}${r}`;
}

/** Путь столбика от базовой линии до значения v (>0 вверх, <0 вниз), скруглённый на дальнем от базы конце. */
function barPath(cx: number, w: number, v: number, maxAbs: number): string | null {
  if (v === 0 || maxAbs === 0) return null;
  const h = (Math.abs(v) / maxAbs) * halfH;
  if (h < 0.5) return null;
  const xL = cx - w / 2;
  const xR = cx + w / 2;
  const r = Math.min(RADIUS, w / 2, h);
  if (v > 0) {
    const yTop = yBase - h;
    return `M ${xL},${yBase} L ${xL},${yTop + r} Q ${xL},${yTop} ${xL + r},${yTop} L ${xR - r},${yTop} Q ${xR},${yTop} ${xR},${yTop + r} L ${xR},${yBase} Z`;
  }
  const yBot = yBase + h;
  return `M ${xL},${yBase} L ${xR},${yBase} L ${xR},${yBot - r} Q ${xR},${yBot} ${xR - r},${yBot} L ${xL + r},${yBot} Q ${xL},${yBot} ${xL},${yBot - r} Z`;
}

function shortLabel(rangeLabel: string): string {
  // «23–29 июн» → «23 июн»; кросс-месячный «29 июн – 5 июл» → «29 июн»
  // (пробелы вокруг тире опциональны — weekRangeLabel ставит их в кросс-месячном виде)
  const m = rangeLabel.match(/^(\d+)(?:\s(\S+))?\s?–\s?\d+\s(\S+)$/);
  return m ? `${m[1]} ${m[2] ?? m[3]}` : rangeLabel;
}

export default function WeeklyFlowChart({ weeks }: Props) {
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
      const tipW = 220;
      const tipH = 100;
      const clampedX = Math.min(Math.max(rawX + 12, 4), bbox.width - tipW - 4);
      const clampedY = Math.max(Math.min(e.clientY - bbox.top - tipH / 2, bbox.height - tipH - 4), 4);
      setTooltipPos({ x: clampedX, y: clampedY });
    },
    [n]
  );

  const handleMouseLeave = useCallback(() => setHoverIdx(null), []);

  if (n === 0) {
    return <p className="text-sm text-neutral-400">нет данных о задачах</p>;
  }

  const maxAbs = Math.max(1, ...weeks.map((w) => Math.max(w.createdSp, w.closedSp)));
  const slotW = chartW / n;
  const barW = Math.min(28, Math.max(4, slotW - 4));

  // экстремумы нетто + текущая неделя — единственные, где подписываем число
  let maxIdx = 0;
  let minIdx = 0;
  weeks.forEach((w, i) => {
    if (w.net > weeks[maxIdx].net) maxIdx = i;
    if (w.net < weeks[minIdx].net) minIdx = i;
  });
  const labeledIdx = new Set<number>([maxIdx, minIdx, n - 1]);

  // подписи под столбиками: прореживаем, если недель много
  const maxLabels = Math.max(2, Math.floor(chartW / 46));
  const labelIndices = new Set<number>();
  if (n <= maxLabels) {
    for (let i = 0; i < n; i++) labelIndices.add(i);
  } else {
    const step = (n - 1) / (maxLabels - 1);
    for (let k = 0; k < maxLabels; k++) labelIndices.add(Math.round(k * step));
  }
  labelIndices.add(n - 1);

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
          aria-label="Поток по неделям: заведено и закрыто SP"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* нулевая базовая линия */}
          <line x1={PAD.l} y1={yBase} x2={W - PAD.r} y2={yBase} stroke="#d4d4d4" strokeWidth={1} />

          {weeks.map((w, i) => {
            const cx = xOf(i, n);
            const opacity = w.isCurrent ? 0.5 : 1;
            const upPath = barPath(cx, barW, w.createdSp, maxAbs);
            const downPath = barPath(cx, barW, -w.closedSp, maxAbs);
            const netY = yBase - (w.net / maxAbs) * halfH;
            const showNetLabel = labeledIdx.has(i) && w.net !== 0;
            return (
              <g key={w.weekStart} opacity={opacity}>
                {upPath && <path d={upPath} fill={CREATED_COLOR} />}
                {downPath && <path d={downPath} fill={CLOSED_COLOR} />}

                {/* засечка нетто */}
                {w.net !== 0 && (
                  <>
                    <line
                      x1={cx - barW / 2 - 2}
                      x2={cx + barW / 2 + 2}
                      y1={netY}
                      y2={netY}
                      stroke="#404040"
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                    {showNetLabel && (
                      <text
                        x={cx}
                        y={w.net > 0 ? netY - 6 : netY + 13}
                        fontSize={11}
                        fontWeight={600}
                        fill="#404040"
                        textAnchor="middle"
                      >
                        {fmtSigned(w.net)}
                      </text>
                    )}
                  </>
                )}

                {/* пунктирная рамка «неделя идёт» */}
                {w.isCurrent && (
                  <rect
                    x={cx - slotW / 2 + 1}
                    y={PAD.t}
                    width={slotW - 2}
                    height={chartH}
                    fill="none"
                    stroke="#a3a3a3"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    rx={4}
                  />
                )}

                {/* подпись недели под столбиком */}
                {labelIndices.has(i) && (
                  <text x={cx} y={H - PAD.b + 16} fontSize={10} fill="#a3a3a3" textAnchor="middle">
                    {shortLabel(w.rangeLabel)}
                    {w.isCurrent ? " · идёт" : ""}
                  </text>
                )}
              </g>
            );
          })}

          {/* ховер: вертикальная направляющая */}
          {hoverIdx !== null && (
            <line
              x1={xOf(hoverIdx, n)}
              y1={PAD.t}
              x2={xOf(hoverIdx, n)}
              y2={H - PAD.b}
              stroke="#6b7280"
              strokeWidth={1}
              strokeDasharray="4 3"
              strokeLinecap="round"
              opacity={0.4}
            />
          )}
        </svg>

        {hoverIdx !== null && hw && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-lg"
            style={{ left: tooltipPos.x, top: tooltipPos.y, minWidth: "210px" }}
          >
            <p className="mb-1 text-xs font-semibold text-neutral-600">
              {hw.rangeLabel}
              {hw.isCurrent && <span className="font-normal text-neutral-400"> · неделя идёт</span>}
            </p>
            <div className="flex flex-col gap-0.5 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: CREATED_COLOR }} />
                <span className="text-neutral-500">заведено</span>
                <span className="ml-auto font-mono font-semibold text-neutral-700">
                  {hw.createdSp} SP ({hw.createdCount} {pluralTasks(hw.createdCount)})
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: CLOSED_COLOR }} />
                <span className="text-neutral-500">закрыто</span>
                <span className="ml-auto font-mono font-semibold text-neutral-700">
                  {hw.closedSp} SP ({hw.closedCount} {pluralTasks(hw.closedCount)})
                </span>
              </span>
              <span className="mt-0.5 text-neutral-400">нетто {fmtSigned(hw.net)} SP</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-2 flex gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: CREATED_COLOR }} />
          заведено
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: CLOSED_COLOR }} />
          закрыто
        </span>
        <span className="ml-auto text-neutral-400">
          {n} {n === 1 ? "неделя" : n < 5 ? "недели" : "недель"}
        </span>
      </div>
    </div>
  );
}
