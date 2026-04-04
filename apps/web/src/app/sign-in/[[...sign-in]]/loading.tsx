export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 space-y-5 animate-pulse">
        <div className="h-6 w-32 rounded-md bg-zinc-800" />
        <div className="space-y-3">
          <div className="h-4 w-20 rounded bg-zinc-800" />
          <div className="h-10 w-full rounded-lg bg-zinc-800" />
        </div>
        <div className="space-y-3">
          <div className="h-4 w-20 rounded bg-zinc-800" />
          <div className="h-10 w-full rounded-lg bg-zinc-800" />
        </div>
        <div className="h-10 w-full rounded-full bg-zinc-800" />
        <div className="h-4 w-40 mx-auto rounded bg-zinc-800" />
      </div>
    </div>
  );
}
