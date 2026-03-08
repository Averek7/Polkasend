"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navbar } from "../../components/layout/Navbar";
import { CheckCircle2, Circle, Loader2, Search, XCircle } from "lucide-react";

type OrderResponse = {
  orderId: string;
  status:
    | "Initiated"
    | "RateLocked"
    | "CompliancePassed"
    | "SettlementTriggered"
    | "Completed"
    | "Failed";
  txHash: string;
  utrNumber?: string | null;
  amount?: number;
  currency?: string;
  etaSeconds?: number;
  createdAt?: string;
};

const FLOW = [
  "Initiated",
  "RateLocked",
  "CompliancePassed",
  "SettlementTriggered",
  "Completed",
] as const;

export default function TrackPage() {
  const [orderId, setOrderId] = useState("");
  const [result, setResult] = useState<OrderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialOrderId = params.get("orderId");
    if (initialOrderId) {
      setOrderId(initialOrderId);
      void fetchOrder(initialOrderId);
    }
  }, []);

  const currentStep = useMemo(() => {
    if (!result) return -1;
    return FLOW.indexOf(result.status as (typeof FLOW)[number]);
  }, [result]);

  const fetchOrder = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/remittance?orderId=${encodeURIComponent(id)}`);
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Unable to fetch order");
      }
      const data = (await response.json()) as OrderResponse;
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orderId.trim()) return;
    await fetchOrder(orderId.trim());
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Navbar />
      <main className="px-6 pb-16 pt-28">
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <h1 className="font-display text-3xl font-black md:text-5xl">
              Track Transfer
            </h1>
            <p className="mt-2 text-sm text-[#7070a0] md:text-base">
              Enter your on-chain order ID to view lifecycle progress and receipt.
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-white/[0.07] bg-[#16161e] p-4 md:p-5"
          >
            <label className="mb-2 block text-xs font-mono uppercase tracking-wider text-[#7070a0]">
              Order ID
            </label>
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="0x..."
                className="h-12 flex-1 rounded-xl border border-white/[0.1] bg-[#1c1c26] px-4 font-mono text-sm text-[#f0f0f8] outline-none"
              />
              <button
                type="submit"
                disabled={loading || !orderId.trim()}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#E6007A] px-6 font-semibold text-white disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? "Fetching..." : "Track Order"}
              </button>
            </div>
          </form>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {result && (
            <section className="rounded-2xl border border-white/[0.07] bg-[#16161e] p-5">
              <div className="mb-5 grid gap-4 md:grid-cols-3">
                <div>
                  <div className="text-xs text-[#7070a0]">Order ID</div>
                  <div className="font-mono text-xs text-[#6c9fff] break-all">{result.orderId}</div>
                </div>
                <div>
                  <div className="text-xs text-[#7070a0]">Status</div>
                  <div className="font-semibold text-[#f0f0f8]">{result.status}</div>
                </div>
                <div>
                  <div className="text-xs text-[#7070a0]">ETA</div>
                  <div className="font-semibold text-[#f0f0f8]">
                    {result.status === "Completed" ? "Settled" : `${result.etaSeconds ?? 0}s`}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {FLOW.map((step, index) => {
                  const done = currentStep > index;
                  const active = currentStep === index;

                  return (
                    <div key={step} className="flex items-center gap-3 text-sm">
                      <div className="flex h-6 w-6 items-center justify-center">
                        {done && <CheckCircle2 className="h-5 w-5 text-[#00e887]" />}
                        {active && result.status !== "Failed" && (
                          <Loader2 className="h-5 w-5 animate-spin text-[#E6007A]" />
                        )}
                        {!done && !active && <Circle className="h-5 w-5 text-[#7070a0]" />}
                      </div>
                      <span className={done || active ? "text-[#f0f0f8]" : "text-[#7070a0]"}>
                        {step}
                      </span>
                    </div>
                  );
                })}

                {result.status === "Failed" && (
                  <div className="flex items-center gap-3 text-sm text-red-300">
                    <XCircle className="h-5 w-5" />
                    Settlement failed
                  </div>
                )}
              </div>

              {result.utrNumber && (
                <div className="mt-5 rounded-xl border border-[#00e887]/20 bg-[#00e887]/10 p-3">
                  <div className="text-xs text-[#7070a0]">UPI UTR</div>
                  <div className="font-mono text-sm text-[#00e887]">{result.utrNumber}</div>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
