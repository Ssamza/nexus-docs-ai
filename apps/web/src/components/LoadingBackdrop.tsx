"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function DocumentScanner() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-9 h-12 rounded border border-zinc-600 bg-zinc-900 overflow-hidden shadow-lg">
        <div className="absolute inset-x-0 h-px bg-emerald-400/80 shadow-[0_0_6px_1px_rgba(52,211,153,0.4)] animate-[scan_0.8s_ease-in-out_infinite]" />
        <div className="absolute inset-0 flex flex-col justify-center gap-1 px-1.5">
          {[100, 75, 90, 60, 80].map((w, i) => (
            <div key={i} className="h-px rounded-full bg-zinc-700" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>

<style>{`
        @keyframes scan {
          0%   { top: 0%; }
          50%  { top: calc(100% - 1px); }
          100% { top: 0%; }
        }
      `}</style>
    </div>
  );
}

export function NavLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    router.push(href);
  };

  return (
    <>
      {loading && (
        <div className="fixed inset-0 z-50 bg-zinc-950/85 backdrop-blur-sm flex items-center justify-center">
          <DocumentScanner />
        </div>
      )}
      <a href={href} onClick={handleClick} className={className}>
        {children}
      </a>
    </>
  );
}
