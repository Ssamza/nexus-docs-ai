import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { t } from "@/lib/t";
import { NavLink } from "@/components/LoadingBackdrop";
import { Accordion } from "@/components/Accordion";
import { Ticker } from "@/components/Ticker";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col items-center justify-start py-20 bg-zinc-950 text-zinc-100 px-6">
      <div className="w-full max-w-xl space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight">{t.app.name}</h1>
          <p className="text-2xl font-medium text-zinc-100">{t.app.hook}</p>
          <p className="text-zinc-500 text-base">{t.app.tagline}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 text-left text-sm text-zinc-400 max-w-sm mx-auto">
          {t.landing.features.map((feature) => (
            <div key={feature} className="flex gap-3">
              <span className="text-emerald-500">✓</span>
              {feature}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row justify-center">
          <NavLink
            href="/dashboard"
            className="rounded-full bg-white text-black px-6 py-3 font-medium hover:bg-zinc-200 transition-colors"
          >
            {t.landing.cta_primary}
          </NavLink>
          <NavLink
            href="/sign-in"
            className="rounded-full border border-zinc-700 px-6 py-3 font-medium hover:border-zinc-500 transition-colors"
          >
            {t.landing.cta_secondary}
          </NavLink>
        </div>

        <p className="text-xs text-zinc-600">{t.landing.footer}</p>
      </div>

      <div className="w-full max-w-3xl mt-10">
        <Ticker />
      </div>

      <div className="w-full max-w-xl mt-4">
        <Accordion items={t.landing.how_it_works} />
      </div>
    </div>
  );
}
