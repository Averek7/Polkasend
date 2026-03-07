"use client";
import { motion } from "framer-motion";

interface Props {
  sendAmount: number;
  assetId: string;
  fxRate: number;
  inrAmount: number;
}

export function FeeBreakdown({ sendAmount, assetId, fxRate, inrAmount }: Props) {
  const fee = sendAmount * 0.005;
  const gas = 0.05;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#16161e] p-5">
      <p className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-[#7070a0]">
        Fee Breakdown
      </p>

      <div className="space-y-2.5">
        {[
          { label: "Send amount", value: `$${sendAmount.toFixed(2)}`, color: "#f0f0f8" },
          { label: "Protocol fee (0.5%)", value: `-$${fee.toFixed(2)}`, color: "#E6007A" },
          { label: "FX spread", value: "$0.00 ✓", color: "#00e887" },
          { label: `Gas (in PST)`, value: `~$${gas.toFixed(2)}`, color: "#00e887" },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-center justify-between border-b border-white/[0.04] pb-2.5 text-sm last:border-0 last:pb-0">
            <span className="text-[#7070a0]">{label}</span>
            <span className="font-semibold" style={{ color }}>{value}</span>
          </div>
        ))}

        <div className="flex items-center justify-between rounded-xl border border-[#00e887]/15 bg-[#00e887]/[0.04] px-3 py-2.5">
          <span className="text-sm font-semibold text-[#f0f0f8]">Recipient gets</span>
          <span className="font-mono font-bold text-[#00e887]">
            ₹{inrAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg bg-[#1c1c26] px-3 py-2 text-[11px]">
        <span className="text-[#7070a0]">Live oracle rate</span>
        <span className="font-mono text-[#f0f0f8]">₹{fxRate.toFixed(2)} / {assetId}</span>
      </div>
    </div>
  );
}
