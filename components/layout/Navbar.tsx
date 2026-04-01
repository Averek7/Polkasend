"use client";

import { useEffect, useState } from "react";
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
  const [scrolled, setScrolled] = useState(false);
  const {
    address,
    name,
    walletName,
    walletFamily,
    canSign,
    connect,
    disconnect,
    isConnecting,
    modalOpen,
    wallets,
    accounts,
    selectedWalletId,
    error,
    initialize,
    closeModal,
    selectWallet,
    selectAccount,
    resetSelection,
  } = useWalletStore();

  const shortAddr = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null;
  const walletLabel = name ?? shortAddr ?? "Connect Wallet";
  const substrateWallets = wallets.filter((wallet) => wallet.family === "substrate");
  const evmWallets = wallets.filter((wallet) => wallet.family === "evm");
  const svmWallets = wallets.filter((wallet) => wallet.family === "svm");

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50">
        <motion.div
          initial={false}
          animate={{
            paddingTop: scrolled ? 12 : 0,
            paddingLeft: scrolled ? 12 : 0,
            paddingRight: scrolled ? 12 : 0,
          }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            initial={false}
            animate={{
              borderRadius: scrolled ? 28 : 0,
              borderColor: scrolled
                ? "rgba(255,255,255,0.1)"
                : "rgba(255,255,255,0.06)",
              backgroundColor: scrolled
                ? "rgba(10,10,10,0.74)"
                : "rgba(10,10,10,0.88)",
              boxShadow: scrolled
                ? "0 18px 48px rgba(0,0,0,0.28)"
                : "0 0 0 rgba(0,0,0,0)",
            }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            style={{
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              borderWidth: "1px",
              borderStyle: "solid",
            }}
          >
            <motion.div
              className="mx-auto max-w-7xl px-6"
              initial={false}
              animate={{
                paddingTop: scrolled ? 12 : 16,
                paddingBottom: scrolled ? 12 : 16,
              }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
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
                    {isConnecting ? "Connecting…" : walletLabel}
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
            </motion.div>
          </motion.div>
        </motion.div>
      </header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-x-3 z-40 md:hidden"
            style={{
              top: scrolled ? "88px" : "76px",
              background: "rgba(17,17,22,0.98)",
              borderRadius: "24px",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 18px 48px rgba(0,0,0,0.32)",
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
                {walletLabel}
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center px-4"
            style={{ background: "rgba(3,4,8,0.72)", backdropFilter: "blur(10px)" }}
            onClick={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-xl overflow-hidden rounded-[28px]"
              style={{
                background: "rgba(14,14,20,0.94)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 32px 80px rgba(0,0,0,0.42)",
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-5 border-b"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}
              >
                <div>
                  <div className="text-xs uppercase tracking-[0.24em]" style={{ color: "#7070a0" }}>
                    Wallet Access
                  </div>
                  <div className="mt-1 text-xl font-bold text-white">
                    {selectedWalletId ? "Choose an account" : "Connect a Polkadot wallet"}
                  </div>
                  <div className="mt-1 text-sm" style={{ color: "#8b8ba7" }}>
                    {selectedWalletId
                      ? "Pick the account you want to use with PolkaSend."
                      : "Substrate is operational now. EVM and Solana are staged as funding rails."}
                  </div>
                </div>
                <button
                  className="rounded-full p-2 text-polka-muted hover:text-white"
                  onClick={closeModal}
                  aria-label="Close wallet modal"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="px-6 py-5">
                {selectedWalletId ? (
                  <button
                    onClick={resetSelection}
                    className="mb-4 inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      color: "#b8b8ce",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    Back to wallets
                  </button>
                ) : null}

                {error ? (
                  <div
                    className="mb-4 rounded-2xl px-4 py-3 text-sm"
                    style={{
                      background: "rgba(230,0,122,0.08)",
                      border: "1px solid rgba(230,0,122,0.18)",
                      color: "#ffc1df",
                    }}
                  >
                    {error}
                  </div>
                ) : null}

                {!selectedWalletId ? (
                  <div className="space-y-5">
                    <div>
                      <div className="mb-3 text-xs uppercase tracking-[0.2em]" style={{ color: "#7070a0" }}>
                        Operational Wallet
                      </div>
                      <div className="grid gap-3">
                        {substrateWallets.map((wallet) => (
                          <button
                            key={wallet.id}
                            onClick={() => selectWallet(wallet.id)}
                            className="flex items-center justify-between rounded-2xl px-4 py-4 text-left transition-all duration-200 hover:scale-[1.01]"
                            style={{
                              background: "rgba(255,255,255,0.03)",
                              border: "1px solid rgba(255,255,255,0.07)",
                            }}
                          >
                            <div>
                              <div className="text-base font-semibold text-white">{wallet.name}</div>
                              <div className="mt-1 text-sm" style={{ color: "#8b8ba7" }}>
                                {wallet.description}
                              </div>
                            </div>
                            <div
                              className="rounded-full px-3 py-1 text-xs font-semibold"
                              style={{
                                background: "rgba(0,232,135,0.08)",
                                color: "#00e887",
                                border: "1px solid rgba(0,232,135,0.18)",
                              }}
                            >
                              Connect
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-3 text-xs uppercase tracking-[0.2em]" style={{ color: "#7070a0" }}>
                        EVM Funding Wallets
                      </div>
                      <div className="grid gap-3">
                        {evmWallets.map((wallet) => (
                          <div
                            key={wallet.id}
                            className="flex items-center justify-between rounded-2xl px-4 py-4"
                            style={{
                              background: "rgba(255,255,255,0.02)",
                              border: "1px solid rgba(255,255,255,0.05)",
                              opacity: 0.72,
                            }}
                          >
                            <div>
                              <div className="text-base font-semibold text-white">{wallet.name}</div>
                              <div className="mt-1 text-sm" style={{ color: "#8b8ba7" }}>
                                {wallet.description}
                              </div>
                            </div>
                            <div
                              className="rounded-full px-3 py-1 text-xs font-semibold"
                              style={{
                                background: "rgba(108,159,255,0.08)",
                                color: "#8db4ff",
                                border: "1px solid rgba(108,159,255,0.18)",
                              }}
                            >
                              Planned
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-3 text-xs uppercase tracking-[0.2em]" style={{ color: "#7070a0" }}>
                        Solana Funding Wallets
                      </div>
                      <div className="grid gap-3">
                        {svmWallets.map((wallet) => (
                          <div
                            key={wallet.id}
                            className="flex items-center justify-between rounded-2xl px-4 py-4"
                            style={{
                              background: "rgba(255,255,255,0.02)",
                              border: "1px solid rgba(255,255,255,0.05)",
                              opacity: 0.72,
                            }}
                          >
                            <div>
                              <div className="text-base font-semibold text-white">{wallet.name}</div>
                              <div className="mt-1 text-sm" style={{ color: "#8b8ba7" }}>
                                {wallet.description}
                              </div>
                            </div>
                            <div
                              className="rounded-full px-3 py-1 text-xs font-semibold"
                              style={{
                                background: "rgba(245,197,24,0.08)",
                                color: "#f5c518",
                                border: "1px solid rgba(245,197,24,0.18)",
                              }}
                            >
                              Planned
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {accounts.map((account) => (
                      <button
                        key={account.address}
                        onClick={() => selectAccount(account.address)}
                        className="rounded-2xl px-4 py-4 text-left transition-all duration-200 hover:scale-[1.01]"
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.07)",
                        }}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold text-white">
                              {account.name ?? "Unnamed Account"}
                            </div>
                            <div className="mt-1 truncate text-sm" style={{ color: "#8b8ba7" }}>
                              {account.address}
                            </div>
                          </div>
                          <div
                            className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                            style={{
                              background: "rgba(230,0,122,0.08)",
                              color: "#ff7bbf",
                              border: "1px solid rgba(230,0,122,0.18)",
                            }}
                          >
                            Use
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {address ? (
                  <div
                    className="mt-5 rounded-2xl px-4 py-3 text-sm"
                    style={{
                      background: "rgba(0,232,135,0.05)",
                      border: "1px solid rgba(0,232,135,0.14)",
                      color: "#cbffe9",
                    }}
                  >
                    Connected: {walletFamily ? `${walletFamily.toUpperCase()} · ` : ""}
                    {walletName ? `${walletName} · ` : ""}
                    {walletLabel}
                    <div className="mt-1 text-xs" style={{ color: canSign ? "#9dffd2" : "#ffd1d1" }}>
                      {canSign ? "Signer ready for Substrate extrinsics." : "Signer not ready yet."}
                    </div>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
