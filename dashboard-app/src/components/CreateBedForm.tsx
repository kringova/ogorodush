"use client";

import { useState } from "react";
const BED_COOKIE = "ogorod_bed";

export default function CreateBedForm() {
  const [name, setName] = useState("");
  const [type, setType] = useState<"agent" | "user">("agent");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/beds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка создания");
      } else {
        setCreated({ id: data.id, name: data.name });
        // Переключиться на новую грядку
        const maxAge = 60 * 60 * 24 * 365;
        document.cookie = `${BED_COOKIE}=${encodeURIComponent(data.id)}; path=/; max-age=${maxAge}; SameSite=Lax`;
        setName("");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-neutral-900">Создать грядку</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Название
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Личное, Экспериментальная..."
            required
            maxLength={80}
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Тип
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "agent" | "user")}
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            <option value="agent">agent — ведёт ИИ-агент</option>
            <option value="user">user — ведёт человек</option>
          </select>
        </div>
        {error && (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}
        {created && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Грядка <strong>{created.name}</strong> (id: {created.id}) создана.{" "}
            <a href="/" className="underline">
              Перейти на главную
            </a>
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
        >
          {loading ? "Создаём..." : "Создать"}
        </button>
      </form>
    </div>
  );
}
