"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

type Plan = "FREE" | "REGISTERED" | "PREMIUM";

const PLAN_CONFIG: Record<Plan, { label: string; classes: string }> = {
  FREE:       { label: "Free",       classes: "bg-zinc-700 text-zinc-300" },
  REGISTERED: { label: "Básico", classes: "bg-blue-900 text-blue-300" },
  PREMIUM:    { label: "Premium",    classes: "bg-amber-900 text-amber-300" },
};

export function UserPlan() {
  const { getToken, isSignedIn } = useAuth();
  const [plan, setPlan] = useState<Plan | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPlan(data.plan as Plan);
      }
    })();
  }, [isSignedIn, getToken]);

  if (!isSignedIn || !plan) return null;

  const config = PLAN_CONFIG[plan];

  return (
    <div className="flex items-center gap-3">
      {/* Plan chip */}
      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${config.classes}`}>
        {config.label}
      </span>

      {/* CTA for non-premium users */}
      {plan !== "PREMIUM" && (
        <a
          href="/pricing"
          className="relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.4)] hover:shadow-[0_0_18px_rgba(251,146,60,0.6)] transition-all duration-200"
        >
          <span>✦</span>
          <span>Hazte Premium</span>
        </a>
      )}
    </div>
  );
}
