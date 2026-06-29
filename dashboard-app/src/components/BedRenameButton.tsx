"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";

/** Переименовать грядку — кнопка + модалка (PATCH /api/beds меняет name). */
export default function BedRenameButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/beds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: value }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Ошибка");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setValue(name);
          setOpen(true);
        }}
        className="rounded-md px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
      >
        Переименовать
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Переименовать грядку">
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="mb-1 block text-[13px] font-medium text-neutral-700">Название</label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              maxLength={80}
              autoFocus
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-accent)]/30"
            />
            <p className="mt-1 text-xs text-neutral-400">
              Меняется только название. Идентификатор грядки (<span className="font-mono">{id}</span>) не меняется.
            </p>
          </div>
          {error && (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm text-neutral-500 transition hover:text-neutral-800"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={busy || !value.trim()}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
            >
              {busy ? "Сохраняем…" : "Сохранить"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
