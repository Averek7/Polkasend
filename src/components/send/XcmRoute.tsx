"use client";

export function XcmRoute() {
  const steps = [
    { label: "Moonbeam (EVM)", color: "#6c9fff", note: "ERC-20 entry" },
    { label: "AssetHub (USDC)", color: "#9b59d0", note: "Reserve transfer" },
    { label: "PolkaSend Para #3000", color: "#E6007A", note: "Core runtime" },
    { label: "Acala DEX → iINR", color: "#f5c518", note: "FX swap via XCM" },
    { label: "UPI Oracle → Recipient", color: "#00e887", note: "Last-mile INR" },
  ];

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#16161e] p-5">
      <p className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-[#7070a0]">
        XCM Route
      </p>
      <div className="space-y-0">
        {steps.map(({ label, color, note }, i) => (
          <div key={label} className="flex items-stretch gap-3">
            <div className="flex flex-col items-center">
              <div
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ background: color, boxShadow: `0 0 6px ${color}80` }}
              />
              {i < steps.length - 1 && (
                <div
                  className="w-px flex-1"
                  style={{ background: `linear-gradient(to bottom, ${color}40, ${steps[i+1].color}40)` }}
                />
              )}
            </div>
            <div className="pb-3">
              <div className="text-sm font-medium text-[#f0f0f8]" style={{ fontFamily: "var(--font-mono)" }}>
                {label}
              </div>
              <div className="text-[11px] text-[#7070a0]">{note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChainStatusWidget() {
  // In production this would use useQuery + WebSocket subscription
  const stats = [
    { label: "Relay block", value: "#21,453,271", mono: true },
    { label: "Para block", value: "#1,034,521", mono: true },
    { label: "Validators", value: "297 / 300", color: "#00e887" },
    { label: "Liquidity pool", value: "$4.2M USDC", color: "#00e887" },
  ];

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#16161e] p-5">
      <div className="mb-4 flex items-center gap-2">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[#7070a0]">
          Network Status
        </p>
        <span className="ml-auto flex items-center gap-1.5 rounded-full border border-[#00e887]/20 bg-[#00e887]/5 px-2 py-0.5 text-[10px] font-mono text-[#00e887]">
          <span className="h-1 w-1 animate-pulse rounded-full bg-[#00e887]" />
          LIVE
        </span>
      </div>
      <div className="space-y-2">
        {stats.map(({ label, value, mono, color }) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-[#7070a0]">{label}</span>
            <span
              className={mono ? "font-mono" : "font-medium"}
              style={{ color: color ?? "#f0f0f8" }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
