"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowDown, Zap, Building2, Link2, Fingerprint, RefreshCw, Lock, Info } from "lucide-react";
import { useSendStore, useWalletStore } from "@/store";
import { SendModal } from "./SendModal";
import { KycBar } from "./KycBar";
import { FeeBreakdown } from "./FeeBreakdown";
import { XcmRoute } from "./XcmRoute";
import { ChainStatusWidget } from "./ChainStatusWidget";

const schema = z.object({
  sendAmount: z.string().min(1).refine((v) => !isNaN(Number(v)) && Number(v) >= 1, {
    message: "Minimum $1",
  }),
  recipientId: z.string().min(3, "Enter UPI ID, wallet, or Aadhaar number"),
});

type FormData = z.infer<typeof schema>;

const ASSETS = [
  { id: "USDC", flag: "🇺🇸", name: "USD Coin" },
  { id: "USDT", flag: "🇦🇪", name: "Tether USD" },
  { id: "DAI", flag: "🇬🇧", name: "Dai" },
] as const;

const DELIVERY_MODES = [
  { id: "UPI_INSTANT", icon: Zap, label: "UPI Instant", speed: "~30 sec", color: "#00e887" },
  { id: "IMPS_NEFT", icon: Building2, label: "IMPS/NEFT", speed: "~2 min", color: "#6c9fff" },
  { id: "IINR_WALLET", icon: Link2, label: "iINR Wallet", speed: "~6 sec", color: "#E6007A" },
  { id: "AADHAAR_PAY", icon: Fingerprint, label: "Aadhaar Pay", speed: "~45 sec", color: "#f5c518" },
] as const;

export function SendPanel() {
  const { account, kycRecord } = useWalletStore();
  const {
    sendAmount, setSendAmount,
    selectedAsset, setSelectedAsset,
    recipientId, setRecipientId,
    deliveryMode, setDeliveryMode,
    fxRate,
  } = useSendStore();

  const [showModal, setShowModal] = useState(false);
  const [assetIdx, setAssetIdx] = useState(0);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { sendAmount: "200", recipientId: "" },
  });

  const watchedAmount = watch("sendAmount");

  const amount = parseFloat(watchedAmount) || 0;
  const fee = amount * 0.005;
  const netUsd = amount - fee;
  const inrAmount = netUsd * fxRate;
  const bankFeeInr = amount * 0.04 * fxRate;
  const polkaFeeInr = fee * fxRate;
  const savingsInr = bankFeeInr - polkaFeeInr;

  function cycleAsset() {
    const next = (assetIdx + 1) % ASSETS.length;
    setAssetIdx(next);
    setSelectedAsset(ASSETS[next].id);
  }

  function onSubmit(data: FormData) {
    if (!account) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!kycRecord) {
      toast.error("Complete KYC verification before sending");
      return;
    }
    setSendAmount(data.sendAmount);
    setRecipientId(data.recipientId);
    setShowModal(true);
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
        {/* ── LEFT: FORM ── */}
        <div className="space-y-4">
          <KycBar />

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Send amount */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#16161e] p-5">
              <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-widest text-[#7070a0]">
                You send
              </p>
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#1c1c26] px-4 py-3 focus-within:border-[#E6007A]/50 transition">
                <input
                  {...register("sendAmount")}
                  type="number"
                  step="any"
                  className="min-w-0 flex-1 bg-transparent font-display text-3xl font-bold text-[#f0f0f8] outline-none placeholder:text-[#7070a0]"
                  style={{ fontFamily: "var(--font-display)" }}
                  placeholder="200"
                />
                <motion.button
                  type="button"
                  onClick={cycleAsset}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#16161e] px-3 py-2 text-sm font-semibold transition hover:border-[#E6007A]/30"
                >
                  <span className="text-lg">{ASSETS[assetIdx].flag}</span>
                  <span>{ASSETS[assetIdx].id}</span>
                </motion.button>
              </div>
              {errors.sendAmount && (
                <p className="mt-1.5 text-xs text-[#E6007A]">{errors.sendAmount.message}</p>
              )}

              {/* Rate row */}
              <div className="mt-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#E6007A]/20 to-transparent" />
                <div className="flex items-center gap-1.5 rounded-full border border-[#00e887]/20 bg-[#00e887]/5 px-3 py-1 text-xs font-mono text-[#00e887]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00e887]" />
                  ₹{fxRate.toFixed(2)} / {ASSETS[assetIdx].id} · Rate locked
                  <Lock size={10} />
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#E6007A]/20 to-transparent" />
              </div>

              <div className="mt-3 flex items-center justify-center">
                <div className="rounded-full border border-white/[0.08] bg-[#1c1c26] p-2">
                  <ArrowDown size={18} className="text-[#E6007A]" />
                </div>
              </div>

              {/* Receive amount */}
              <div className="mt-3">
                <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-widest text-[#7070a0]">
                  Recipient gets
                </p>
                <div className="flex items-center gap-3 rounded-xl border border-[#00e887]/15 bg-[#00e887]/[0.03] px-4 py-3">
                  <span
                    className="min-w-0 flex-1 font-display text-3xl font-bold text-[#00e887]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    ₹{inrAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                  <div className="flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#16161e] px-3 py-2 text-sm font-semibold">
                    <span className="text-lg">🇮🇳</span>
                    <span>INR</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recipient */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#16161e] p-5">
              <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-widest text-[#7070a0]">
                Recipient
              </p>
              <input
                {...register("recipientId")}
                type="text"
                placeholder="UPI ID (e.g. name@upi), wallet address, or Aadhaar"
                className="w-full rounded-xl border border-white/[0.06] bg-[#1c1c26] px-4 py-3 text-sm text-[#f0f0f8] outline-none placeholder:text-[#7070a0] focus:border-[#E6007A]/50 transition"
              />
              {errors.recipientId && (
                <p className="mt-1.5 text-xs text-[#E6007A]">{errors.recipientId.message}</p>
              )}
            </div>

            {/* Delivery method */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#16161e] p-5">
              <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-widest text-[#7070a0]">
                Delivery method
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {DELIVERY_MODES.map(({ id, icon: Icon, label, speed, color }) => {
                  const active = deliveryMode === id;
                  return (
                    <motion.button
                      key={id}
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setDeliveryMode(id)}
                      className={`relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition ${
                        active
                          ? "bg-[#E6007A]/[0.07]"
                          : "border-white/[0.06] bg-[#1c1c26] hover:border-white/20"
                      }`}
                      style={{ borderColor: active ? `${color}40` : undefined }}
                    >
                      <Icon size={18} style={{ color: active ? color : "#7070a0" }} />
                      <span className="text-[11px] font-semibold text-[#f0f0f8]">{label}</span>
                      <span className="text-[10px] font-mono" style={{ color }}>
                        {speed}
                      </span>
                      {active && (
                        <motion.span
                          layoutId="delivery-active"
                          className="absolute inset-0 rounded-xl"
                          style={{ border: `1px solid ${color}40` }}
                          transition={{ type: "spring", bounce: 0.2 }}
                        />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Savings callout */}
            {amount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 rounded-2xl border border-[#00e887]/15 bg-[#00e887]/[0.04] px-4 py-3"
              >
                <Info size={15} className="shrink-0 text-[#00e887]" />
                <p className="text-sm text-[#7070a0]">
                  You save{" "}
                  <span className="font-semibold text-[#00e887]">
                    ₹{savingsInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>{" "}
                  vs a traditional bank wire on this transfer
                </p>
              </motion.div>
            )}

            {/* Submit */}
            <motion.button
              type="submit"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full rounded-2xl bg-[#E6007A] py-4 text-base font-bold text-white shadow-[0_8px_32px_rgba(230,0,122,0.25)] transition hover:bg-[#cc006b] hover:shadow-[0_8px_40px_rgba(230,0,122,0.4)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!account}
            >
              🚀 &nbsp; Send via PolkaSend Parachain
            </motion.button>
          </form>
        </div>

        {/* ── RIGHT: SIDEBAR ── */}
        <div className="space-y-4">
          <FeeBreakdown
            sendAmount={amount}
            assetId={ASSETS[assetIdx].id}
            fxRate={fxRate}
            inrAmount={inrAmount}
          />
          <XcmRoute />
          <ChainStatusWidget />
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <SendModal
            sendAmount={amount}
            assetId={ASSETS[assetIdx].id}
            inrAmount={inrAmount}
            deliveryMode={deliveryMode}
            recipientId={watch("recipientId")}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
