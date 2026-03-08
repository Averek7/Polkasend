"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PolkaSendLogo } from "../logo/PolkaSendLogo";
import { useWalletStore } from "../../lib/polkadot/walletStore";
import { Menu, X } from "lucide-react";

type NavHref = "/" | "/send" | "/track" | "/dashboard";

const NAV_LINKS: Array<{ href: NavHref; label: string }> = [
  { href: "/", label: "Home" },
  { href: "/send", label: "Send Money" },
  { href: "/track", label: "Track" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { address, connect, disconnect, isConnecting } = useWalletStore();

  const shortAddr = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50">
        <div
          className="mx-auto max-w-7xl px-6 py-4"
          style={{
            background: "rgba(10,10,10,0.85)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center justify-between">
            <Link href="/">
              <PolkaSendLogo size={36} animate />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map(({ href, label }) => {
                const active = isActive(href);

                return (
                  <Link
                    key={href}
                    href={href}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                      active
                        ? "bg-polka-pink text-white shadow-lg"
                        : "text-polka-muted hover:text-polka-text hover:bg-polka-card2"
                    }`}
                    style={
                      active
                        ? { boxShadow: "0 4px 20px rgba(230,0,122,0.35)" }
                        : {}
                    }
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* Right Side */}
            <div className="flex items-center gap-3">
              {/* Wallet Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={address ? disconnect : connect}
                disabled={isConnecting}
                className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                  address
                    ? "border-polka-green text-polka-green bg-polka-green/5 hover:bg-polka-green/10"
                    : "border-polka-border text-polka-muted hover:border-polka-pink hover:text-polka-pink"
                }`}
              >
                {address && (
                  <span className="w-2 h-2 rounded-full bg-polka-green animate-pulse" />
                )}
                {isConnecting ? "Connecting…" : (shortAddr ?? "Connect Wallet")}
              </motion.button>

              {/* Mobile Menu Button */}
              <button
                className="md:hidden p-2 text-polka-muted"
                onClick={() => setOpen(!open)}
              >
                {open ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-x-0 top-[73px] z-40 md:hidden"
            style={{
              background: "rgba(17,17,22,0.98)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <nav className="flex flex-col p-4 gap-1">
              {NAV_LINKS.map(({ href, label }) => {
                const active = isActive(href);

                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`px-4 py-3 rounded-xl text-sm font-medium ${
                      active
                        ? "bg-polka-pink text-white"
                        : "text-polka-muted hover:text-polka-text"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}

              <button
                onClick={address ? disconnect : connect}
                className="mt-2 px-4 py-3 rounded-xl text-sm font-medium border border-polka-border text-polka-muted"
              >
                {shortAddr ?? "Connect Wallet"}
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
