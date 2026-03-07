"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "../../components/layout/Navbar";
import { useRemittanceStore } from "../../lib/polkadot/remittanceStore";
import { useWalletStore } from "../../lib/polkadot/walletStore";
import { SendForm } from "../../components/remittance/SendForm";
import { FeeBreakdown } from "../../components/remittance/FeeBreakdown";
import { XcmRoute } from "../../components/remittance/XcmRoute";
import { NetworkStatus } from "../../components/remittance/NetworkStatus";
import { TransactionModal } from "../../components/remittance/TransactionModal";
import { KycBanner } from "../../components/remittance/KycBanner";

export default function SendPage() {
  const fetchFxRate = useRemittanceStore((s) => s.fetchFxRate);
  const orderId = useRemittanceStore((s) => s.orderId);

  useEffect(() => {
    fetchFxRate();
    const interval = setInterval(fetchFxRate, 30_000);
    return () => clearInterval(interval);
  }, [fetchFxRate]);

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0a" }}>
      <Navbar />

      {/* BG */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(230,0,122,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(230,0,122,0.04) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
          zIndex: 0,
        }}
      />

      <main className="relative z-10 pt-28 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className="font-mono text-xs px-3 py-1 rounded-full"
                style={{
                  background: "rgba(230,0,122,0.08)",
                  border: "1px solid rgba(230,0,122,0.2)",
                  color: "#E6007A",
                }}
              >
                pallet_remittance
              </div>
              <div
                className="font-mono text-xs px-3 py-1 rounded-full"
                style={{
                  background: "rgba(0,232,135,0.08)",
                  border: "1px solid rgba(0,232,135,0.2)",
                  color: "#00e887",
                }}
              >
                XCM v4 enabled
              </div>
            </div>
            <h1 className="font-display font-black text-3xl md:text-4xl">
              Send Remittance
            </h1>
            <p className="mt-2 text-sm" style={{ color: "#7070a0" }}>
              Cross-border transfer via Polkadot parachain. Rate locked for 15
              minutes.
            </p>
          </motion.div>

          <KycBanner />

          {/* Main grid */}
          <div className="grid lg:grid-cols-[1fr_380px] gap-6">
            <SendForm />
            <div className="flex flex-col gap-4">
              <FeeBreakdown />
              <XcmRoute />
              <NetworkStatus />
            </div>
          </div>
        </div>
      </main>

      {/* Transaction modal */}
      <AnimatePresence>{orderId && <TransactionModal />}</AnimatePresence>
    </div>
  );
}
