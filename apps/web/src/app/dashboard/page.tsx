import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { t } from "@/lib/t";
import { DocumentUpload } from "@/components/DocumentUpload";
import { ChatBox } from "@/components/ChatBox";
import { UserPlan } from "@/components/UserPlan";
import Link from "next/link";

export default async function Dashboard() {
  const { userId } = await auth();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold">{t.app.name}</h1>
          <Link
            href="/pricing"
            className="text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
          >
            Planes
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <UserPlan />
          {userId ? (
            <UserButton />
          ) : (
            <Link
              href="/sign-in"
              className="text-sm px-4 py-2 rounded-full border border-zinc-700 hover:border-zinc-500 transition-colors"
            >
              {t.landing.cta_secondary}
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">{t.dashboard.title}</h2>
          <p className="text-zinc-400">{t.dashboard.subtitle}</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
          <h3 className="font-medium">{t.dashboard.upload.title}</h3>
          <DocumentUpload />
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
          <h3 className="font-medium">{t.dashboard.query.title}</h3>
          <ChatBox />
        </div>
      </main>
    </div>
  );
}
