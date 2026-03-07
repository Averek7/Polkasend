"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, Loader2, Circle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  sendAmount: number;
  assetId: string;
  inrAmount: number;
  deliveryMode: string;
  recipientId: string;
  onClose: () => void;
}

const STEPS = [
  { label: "Broadcasting XCM to relay chain", duration: 1400 },
  { label: "KYC & FEMA compliance check", duration: 900 },
  { label: "FX rate locked on-chain", duration: 700 },
  { label: "Swapping to iINR via Acala DEX", duration: 1800 },
  { label: "Triggering UPI settlement oracle", duration: 2200 },
  { label: "Confirmation & on-chain receipt", duration: 600 },
];

type StepState = "waiting" | "loading" | "done";

function randomHex(n: number) {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

export function SendModal({ sendAmount, assetId, inrAmount, deliveryMode, recipientId, onClose }: Props) {
  const [stepStates, setStepStates] = useState<StepState[]>(
    Array(STEPS.length).fill("waiting")
  );
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [receipt, setReceipt] = useState<{ orderId: string; block: string; utr: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      for (let i = 0; i < STEPS.length; i++) {
        if (cancelled) return;
        setStepStates((s) => s.map((v, j) => (j === i ? "loading" : v)));
        setProgress(((i + 0.5) / STEPS.length) * 100);
        await new Promise((r) => setTimeout(r, STEPS[i].duration));
        if (cancelled) return;
        setStepStates((s) => s.map((v, j) => (j === i ? "done" : v)));
        setProgress(((i + 1) / STEPS.length) * 100);
      }
      setDone(true);
      setReceipt({
        orderId: "0x" + randomHex(32),
        block: "#" + (21453271 + Math.floor(Math.random() * 20)),
        utr: "HDFC" + Date.now().toString().slice(-12),
      });
      toast.success("Transfer complete! INR delivered.");
    }

    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      onClick={(e) => e.target === e.currentTarget && done && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: "spring", bounce: 0.25 }}
        className="relative w-full max-w-md rounded-3xl border border-[#E6007A]/20 bg-[#16161e] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.5)]"
      >
        {done && (
          <button
            onClick={onClose}
            className="absolute right-5 top-5 rounded-full p-1.5 text-[#7070a0] transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        )}

        {/* Title */}
        <div className="mb-6">
          <h2
            className="text-2xl font-extrabold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {done ? (
              <span className="text-[#00e887]">✓ Transfer Complete!</span>
            ) : (
              "Processing Transfer"
            )}
          </h2>
          <p className="mt-1 text-sm text-[#7070a0]">
            {done
              ? `₹${inrAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })} delivered to recipient`
              : "Broadcasting to PolkaSend parachain via XCM..."}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-[#1c1c26]">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: done
                ? "#00e887"
                : "linear-gradient(90deg, #E6007A, #ff4b9e)",
              boxShadow: done ? "0 0 10px #00e887" : "0 0 10px rgba(230,0,122,0.6)",
            }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>

        {/* Steps */}
        <div className="mb-6 space-y-2.5">
          {STEPS.map(({ label }, i) => {
            const state = stepStates[i];
            return (
              <div key={label} className="flex items-center gap-3 text-sm">
                <div className="shrink-0">
                  {state === "done" ? (
                    <CheckCircle2 size={18} className="text-[#00e887]" />
                  ) : state === "loading" ? (
                    <Loader2 size={18} className="animate-spin text-[#E6007A]" />
                  ) : (
                    <Circle size={18} className="text-[#7070a0]/40" />
                  )}
                </div>
                <span
                  className={
                    state === "done"
                      ? "text-[#f0f0f8]"
                      : state === "loading"
                      ? "text-[#f0f0f8]"
                      : "text-[#7070a0]"
                  }
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Receipt */}
        <AnimatePresence>
          {done && receipt && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a0a0a] p-4"
            >
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#7070a0]">
                On-chain receipt
              </p>
              {[
                ["order_id", receipt.orderId.slice(0, 22) + "..."],
                ["block", receipt.block],
                ["amount_in", `${sendAmount.toFixed(2)} ${assetId}`],
                ["amount_out", `₹${inrAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`],
                ["fx_rate", "₹83.50 / USDC"],
                ["utr_number", receipt.utr],
                ["status", "✓ COMPLETED"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between font-mono text-[11px]">
                  <span className="text-[#7070a0]">{k}:</span>
                  <span className={k === "status" ? "text-[#00e887]" : "text-[#f0f0f8]"}>{v}</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
