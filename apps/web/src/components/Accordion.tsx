"use client";

import { useState } from "react";

type Item = {
  step: string;
  title: string;
  description: string;
};

export function Accordion({ items }: { items: Item[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="w-full divide-y divide-zinc-800 rounded-2xl border border-zinc-800 overflow-hidden">
      {items.map((item) => {
        const isOpen = open === item.step;
        return (
          <button
            key={item.step}
            onClick={() => setOpen(isOpen ? null : item.step)}
            className="w-full text-left bg-zinc-950 hover:bg-zinc-900 transition-colors px-6 py-4 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <span className="text-xs font-mono text-zinc-600 shrink-0">{item.step}</span>
              <div>
                <p className="text-sm font-medium text-zinc-100">{item.title}</p>
                <p
                  className={`text-sm text-zinc-500 overflow-hidden transition-all duration-300 ${
                    isOpen ? "max-h-20 mt-1 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  {item.description}
                </p>
              </div>
            </div>
            <span className={`text-zinc-600 text-lg transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}>
              +
            </span>
          </button>
        );
      })}
    </div>
  );
}
