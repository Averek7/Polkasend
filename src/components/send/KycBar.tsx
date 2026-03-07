"use client";
// KycBar.tsx
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import Link from "next/link";
import { useWalletStore } from "@/store";
import { KycLevel } from "@/types";

export function KycBar() {
  const { account, kycRecord } = useWalletStore();

  if (!account) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#16161e] px-4 py-3 text-sm">
        <ShieldX size={16} className="shrink-0 text-[#ff4757]" />
        <span className="flex-1 text-[#7070a0]">
          Wallet not connected — connect to continue
        </span>
      </div>
    );
  }

  if (!kycRecord || kycRecord.level === KycLevel.None) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[#ff4757]/20 bg-[#ff4757]/[0.04] px-4 py-3 text-sm">
        <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#ff4757] shadow-[0_0_8px_#ff4757]" />
        <span className="flex-1 text-[#7070a0]">
          KYC required —{" "}
          <Link href="/kyc" className="text-[#E6007A] hover:underline">
            Verify Identity
          </Link>
        </span>
        <span className="font-mono text-[10px] text-[#ff4757]">NONE</span>
      </div>
    );
  }

  const isBasic = kycRecord.level === KycLevel.Basic;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#00e887]/20 bg-[#00e887]/[0.04] px-4 py-3 text-sm">
      <div className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[#00e887] shadow-[0_0_8px_#00e887]" />
      <span className="flex-1 text-[#f0f0f8]">
        KYC Verified —{" "}
        {isBasic ? "Basic KYC (limit $2,500/yr)" : "Full KYC (limit $250,000/yr)"}
      </span>
      <span className="font-mono text-[10px] text-[#00e887]">{kycRecord.level}</span>
    </div>
  );
}
