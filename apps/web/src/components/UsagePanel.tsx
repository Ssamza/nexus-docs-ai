"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { t } from "@/lib/t";

type Plan = "FREE" | "REGISTERED" | "PREMIUM";

type Usage = {
  promptsUsed: number;
  promptsLimit: number | null;
  documentsUsed: number;
  documentsLimit: number | null;
  resetsAt: string;
};

type UserData = {
  plan: Plan;
  name: string | null;
  email: string;
  usage: Usage;
};

const PLAN_CLASSES: Record<Plan, string> = {
  FREE: "bg-zinc-700 text-zinc-300",
  REGISTERED: "bg-blue-900 text-blue-300",
  PREMIUM: "bg-amber-900 text-amber-300",
};

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const pct = limit === null ? 0 : Math.min((used / limit) * 100, 100);
  const isWarning = limit !== null && pct >= 80;
  const isFull = limit !== null && pct >= 100;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-zinc-300">{label}</span>
        <span className={isFull ? "text-red-400 font-medium" : "text-zinc-400"}>
          {limit === null ? `${used} / ${t.usage.unlimited}` : `${used} / ${limit}`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-zinc-700 overflow-hidden">
        {limit !== null && (
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isFull ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-blue-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}

export function UsagePanel() {
  const { getToken, isSignedIn } = useAuth();
  const [data, setData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, [isSignedIn, getToken]);

  if (loading) {
    return (
      <div className="p-6 space-y-3 animate-pulse">
        <div className="h-4 bg-zinc-700 rounded w-1/3" />
        <div className="h-2 bg-zinc-700 rounded" />
        <div className="h-2 bg-zinc-700 rounded" />
      </div>
    );
  }

  if (!data) return null;

  const resetDate = new Date(data.usage.resetsAt).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="p-1 space-y-6 min-w-[320px]">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100">{t.usage.title}</h2>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${PLAN_CLASSES[data.plan]}`}>
          {t.plans[data.plan]}
        </span>
      </div>

      <div className="space-y-4">
        <UsageBar
          label={t.usage.prompts_label}
          used={data.usage.promptsUsed}
          limit={data.usage.promptsLimit}
        />
        <UsageBar
          label={t.usage.documents_label}
          used={data.usage.documentsUsed}
          limit={data.usage.documentsLimit}
        />
      </div>

      <p className="text-xs text-zinc-500">
        {t.usage.resets_at} {resetDate}
      </p>

      {data.plan !== "PREMIUM" && (
        <a
          href="/pricing"
          className="block text-center w-full px-4 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 transition-all duration-200"
        >
          {t.usage.upgrade_cta}
        </a>
      )}
    </div>
  );
}
