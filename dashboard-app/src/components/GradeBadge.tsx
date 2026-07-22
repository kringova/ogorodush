/**
 * GradeBadge — аватар грейда как assignee в Jira: круглый аватар с эмодзи-персонажем.
 * Метафора роста: 🐣 junior → 🦆 middle → 🦅 senior.
 * Презентационный компонент, без клиентских хуков.
 */

const GRADE_CONFIG: Record<
  string,
  { emoji: string; bg: string; label: string }
> = {
  junior: { emoji: "🐣", bg: "bg-lime-100", label: "junior" },
  middle: { emoji: "🦆", bg: "bg-sky-100", label: "middle" },
  senior: { emoji: "🦅", bg: "bg-violet-100", label: "senior" },
  // модель вне каталога model-grades.json (#490) — показываем, не прячем
  unknown: { emoji: "❓", bg: "bg-neutral-100", label: "unknown" },
};

const SIZE: Record<string, string> = {
  sm: "h-5 w-5 text-[12px]",
  md: "h-7 w-7 text-base",
  lg: "h-10 w-10 text-2xl",
};

interface GradeBadgeProps {
  tier: string | null | undefined;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function GradeBadge({
  tier,
  showLabel = false,
  size = "md",
}: GradeBadgeProps) {
  if (!tier) return null;
  const cfg = GRADE_CONFIG[tier];
  if (!cfg) return null;

  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={cfg.label}
      aria-label={cfg.label}
    >
      <span
        className={`grid shrink-0 place-items-center rounded-full leading-none ring-1 ring-black/5 ${cfg.bg} ${SIZE[size]}`}
      >
        <span aria-hidden="true">{cfg.emoji}</span>
      </span>
      {showLabel && (
        <span className="text-xs text-neutral-600">{cfg.label}</span>
      )}
    </span>
  );
}
