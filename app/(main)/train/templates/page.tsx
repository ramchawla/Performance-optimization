"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useTemplates,
  useCreateTemplate,
  useArchiveTemplate,
  useReorderTemplates,
} from "@/lib/queries/templates";

export default function TemplatesPage() {
  const { data: templates, isLoading } = useTemplates();
  const createTemplate = useCreateTemplate();
  const archiveTemplate = useArchiveTemplate();
  const reorderTemplates = useReorderTemplates();
  const [name, setName] = useState("");

  function move(index: number, direction: -1 | 1) {
    if (!templates) return;
    const target = index + direction;
    if (target < 0 || target >= templates.length) return;
    const a = templates[index];
    const b = templates[target];
    reorderTemplates.mutate([
      { id: a.id, position: b.position },
      { id: b.id, position: a.position },
    ]);
  }

  return (
    <main className="space-y-4 p-4">
      <h1 className="font-display text-xl font-bold text-fg">Templates</h1>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          createTemplate.mutate(name.trim(), { onSuccess: () => setName("") });
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New template name"
          className="flex-1 rounded-xl border border-surface-raised bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={createTemplate.isPending}
          className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-bg disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      <ul className="space-y-2">
        {templates?.map((t, i) => (
          <li key={t.id} className="flex items-center gap-2 rounded-2xl bg-surface p-3">
            <div className="flex flex-col">
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="text-xs text-muted disabled:opacity-30"
                aria-label="Move up"
              >
                ▲
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === templates.length - 1}
                className="text-xs text-muted disabled:opacity-30"
                aria-label="Move down"
              >
                ▼
              </button>
            </div>
            <Link href={`/train/templates/${t.id}`} className="flex-1 text-sm font-medium text-fg">
              {t.name}
            </Link>
            <button
              onClick={() => {
                if (confirm(`Archive "${t.name}"?`)) archiveTemplate.mutate(t.id);
              }}
              className="text-xs text-red-400"
            >
              Archive
            </button>
          </li>
        ))}
      </ul>

      {templates?.length === 0 && !isLoading && (
        <p className="text-sm text-muted">No templates yet — add one above.</p>
      )}
    </main>
  );
}
