"use client";

/**
 * Modal — универсальный модальный оверлей.
 * Закрывается по Esc, клику на backdrop, кнопке ✕.
 * Переиспользуемый примитив — не привязан к конкретному контенту.
 */

import { useEffect } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Максимальная ширина панели (Tailwind-класс, дефолт max-w-lg) */
  maxWidth?: string;
};

export default function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}: ModalProps) {
  // Закрытие по Esc
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Блокировка скролла body пока модалка открыта
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Панель */}
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className={`relative z-10 flex w-full flex-col rounded-xl bg-white shadow-2xl ${maxWidth} max-h-[90dvh]`}
      >
        {/* Шапка */}
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-5 py-4">
            <h2 className="text-[15px] font-semibold text-neutral-900">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Закрыть"
              className="rounded-md p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
                <path
                  d="M3 3 L12 12 M12 3 L3 12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Контент со скроллом */}
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
