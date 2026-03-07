"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { PolkaSendLogo } from "@/components/logo/PolkaSendLogo";
import { useWalletStore } from "@/store";
import { formatAddress } from "@/lib/polkadot/api";
import { Wallet, LayoutDashboard, Clock, ShieldCheck, Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/send", label: "Send", icon: null },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/history", label: "History", icon: Clock },
  { href: "/kyc", label: "KYC", icon: ShieldCheck },
];

export function Navbar() {
  const pathname = usePathname();
  const { account, isConnecting, disconnect, setConnecting, setAccount } = useWalletStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function connectWallet() {
    setConnecting(true);
    try {
      const { getAccounts } = await import("@/lib/polkadot/api");
      const accounts = await getAccounts();
      if (accounts.length > 0) {
        setAccount({
          address: accounts[0].address,
          name: accounts[0].meta.name,
          source: "polkadot-js",
        });
      }
    } catch (err) {
      console.error("Wallet connect failed:", err);
    } finally {
      setConnecting(false);
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0a]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/">
          <PolkaSendLogo size={36} animated={true} showText={true} />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={href} href={href}>
                <motion.span
                  className={`relative block rounded-xl px-5 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "text-white"
                      : "text-[#7070a0] hover:text-[#f0f0f8]"
                  }`}
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-xl bg-[#E6007A]/10"
                      style={{ border: "1px solid rgba(230,0,122,0.2)" }}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                  <span className="relative z-10">{label}</span>
                </motion.span>
              </Link>
            );
          })}
        </nav>

        {/* Wallet button */}
        <div className="flex items-center gap-3">
          {account ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-[#00e887]/20 bg-[#00e887]/5 px-4 py-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-[#00e887] shadow-[0_0_6px_#00e887]" />
                <span className="font-mono text-[#00e887]">
                  {formatAddress(account.address)}
                </span>
              </div>
              <button
                onClick={disconnect}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-[#7070a0] transition hover:border-[#E6007A]/30 hover:text-[#E6007A]"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={connectWallet}
              disabled={isConnecting}
              className="flex items-center gap-2 rounded-xl bg-[#E6007A] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(230,0,122,0.25)] transition hover:bg-[#cc006b] disabled:opacity-60"
            >
              <Wallet size={15} />
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </motion.button>
          )}

          {/* Mobile menu toggle */}
          <button
            className="rounded-lg p-2 text-[#7070a0] transition hover:text-white md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/[0.06] md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                      active
                        ? "bg-[#E6007A]/10 text-white"
                        : "text-[#7070a0] hover:text-white"
                    }`}
                  >
                    {Icon && <Icon size={16} />}
                    {label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
