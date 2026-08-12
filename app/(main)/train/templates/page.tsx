"use client";

import { useState } from "react";
import Link from "next/link";
import { useTemplates, useCreateTemplate, useArchiveTemplate, useReorderTemplates } from "@/lib/queries/templates";

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
    reorderTemplates.mutate([
      { id: templates[index].id, position: templates[target].position },
      { id: templates[target].id, position: templates[index].position },
    ]);
  }

  function addTemplate(newName: string) {
    createTemplate.mutate(newName);
  }

  function archive(id: string) {
    archiveTemplate.mutate(id);
  }

  return (
    <main className="space-y-4 p-4">
      <h1 className="font-display text-xl font-bold tracking-tight text-fg">Templates</h1>

      <form
        className="flex gap-2 rounded-2xl border border-dashed border-surface-raised p-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addTemplate(name.trim());
          setName("");
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="＋ New template name"
          className="flex-1 rounded-xl bg-transparent px-2 py-2 text-sm text-fg placeholder:text-muted focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-bg transition-transform duration-150 hover:brightness-110 active:scale-90 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {isLoading && (
        <ul className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-16 animate-pulse rounded-2xl bg-surface-raised" />
          ))}
        </ul>
      )}

      <ul className="stagger space-y-2.5">
        {templates?.map((t, i) => {
          const isDeload = t.name.toLowerCase().includes("deload");
          return (
            <li
              key={t.id}
              className="group rounded-2xl bg-surface p-3.5 transition-all duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:bg-surface-raised active:scale-[0.98]"
            >
              <div className="flex items-start gap-2">
                <Link href={`/train/templates/${t.id}`} className="min-w-0 flex-1">
                  <h3 className="font-display text-base font-bold text-fg transition-colors group-hover:text-accent">
                    {t.name}
                  </h3>
                  {t.description && <p className="mt-0.5 truncate text-xs text-muted">{t.description}</p>}
                  {isDeload && (
                    <span className="mt-2 inline-block rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-black">
                      Deload
                    </span>
                  )}
                </Link>
                <div className="flex flex-shrink-0 flex-col">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="text-xs text-muted transition-transform duration-150 hover:text-fg active:scale-90 disabled:opacity-30"
                    aria-label="Move up"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={!templates || i === templates.length - 1}
                    className="text-xs text-muted transition-transform duration-150 hover:text-fg active:scale-90 disabled:opacity-30"
                    aria-label="Move down"
                  >
                    ▼
                  </button>
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-surface-raised pt-2">
                <span className="text-[11px] text-muted">Tap to open</span>
                <button
                  onClick={() => {
                    if (confirm(`Archive "${t.name}"?`)) archive(t.id);
                  }}
                  className="text-xs font-medium text-red-400 transition-transform duration-150 hover:brightness-110 active:scale-90"
                >
                  Archive
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {templates?.length === 0 && !isLoading && (
        <p className="text-sm text-muted">No templates yet — add one above.</p>
      )}
    </main>
  );
}
