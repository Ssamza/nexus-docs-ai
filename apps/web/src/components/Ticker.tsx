import { t } from "@/lib/t";

export function Ticker() {
  const items = t.landing.ticker;
  // Duplicate for seamless loop
  const track = [...items, ...items];

  return (
    <div className="w-full overflow-hidden py-4 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <div className="flex w-max animate-ticker gap-12 whitespace-nowrap">
        {track.map((item, i) => (
          <span key={i} className="flex items-center gap-3 text-sm text-zinc-400">
            <span className="text-emerald-500 text-xs">✦</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
