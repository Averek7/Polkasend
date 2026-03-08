"use client";

import { motion } from "framer-motion";
import { Navbar } from "../../components/layout/Navbar";
import {
  Activity,
  ArrowRight,
  Coins,
  ShieldCheck,
  Timer,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

const heroStats = [
  {
    label: "India remittances 2024",
    value: "$129B",
    sub: "World's largest recipient market",
  },
  { label: "Protocol fee", value: "0.5%", sub: "vs 4-8% traditional rails" },
  { label: "Settlement time", value: "~36s", sub: "UPI-backed delivery" },
  { label: "Annual savings", value: "$8B+", sub: "diaspora cost reduction" },
];

const protocolStats = [
  {
    label: "24h Volume",
    value: "$2.94M",
    delta: "+12.4%",
    icon: Coins,
    color: "#00e887",
  },
  {
    label: "Orders Settled",
    value: "18,472",
    delta: "+7.1%",
    icon: ShieldCheck,
    color: "#6c9fff",
  },
  {
    label: "Success Rate",
    value: "99.92%",
    delta: "+0.03%",
    icon: Activity,
    color: "#f5c518",
  },
  {
    label: "Median Time",
    value: "34.8s",
    delta: "-4.2%",
    icon: Timer,
    color: "#E6007A",
  },
];

const recentTransfers = [
  {
    id: "0x9a4...f21",
    corridor: "US -> IN",
    amount: "$240.00",
    received: "INR 19,884",
    status: "Completed",
  },
  {
    id: "0x1b2...8cd",
    corridor: "UAE -> IN",
    amount: "$600.00",
    received: "INR 49,710",
    status: "Completed",
  },
  {
    id: "0xa77...ff0",
    corridor: "UK -> IN",
    amount: "$120.00",
    received: "INR 9,935",
    status: "In Progress",
  },
];

function HeroStats() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {heroStats.map(({ label, value, sub }, i) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 * i, duration: 0.5 }}
          className="rounded-2xl border border-white/[0.06] bg-[#16161e]/80 px-5 py-4 text-center backdrop-blur"
        >
          <div
            className="mb-1 text-2xl font-extrabold md:text-3xl"
            style={{
              fontFamily: "var(--font-display)",
              background: "linear-gradient(135deg, #E6007A, #ff6eb5)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {value}
          </div>
          <div className="text-xs font-medium text-[#f0f0f8]">{label}</div>
          <div className="mt-0.5 text-[11px] text-[#7070a0]">{sub}</div>
        </motion.div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen" style={{ background: "#0a0a0a" }}>
      <Navbar />
      <main className="relative z-10 px-6 pb-16 pt-28">
        <div className="mx-auto max-w-6xl space-y-8">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#E6007A]/20 bg-[#E6007A]/10 px-3 py-1 font-mono text-xs text-[#E6007A]">
              <TrendingUp className="h-3.5 w-3.5" />
              PolkaSend Analytics
            </div>
            <h1 className="font-display text-3xl font-black md:text-5xl">
              Protocol Dashboard
            </h1>
            <p className="mt-2 text-sm text-[#7070a0] md:text-base">
              Live operational insight for cross-border remittance corridors.
            </p>
          </div>

          <HeroStats />

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {protocolStats.map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + idx * 0.08, duration: 0.35 }}
                  className="rounded-2xl border border-white/[0.07] bg-[#16161e] p-5"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs text-[#7070a0]">{stat.label}</span>
                    <Icon className="h-4 w-4" style={{ color: stat.color }} />
                  </div>
                  <div className="text-3xl font-black">{stat.value}</div>
                  <div className="mt-1 text-xs font-semibold" style={{ color: stat.color }}>
                    {stat.delta} vs previous day
                  </div>
                </motion.div>
              );
            })}
          </section>

          <section className="rounded-2xl border border-white/[0.07] bg-[#16161e] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Recent Transfers</h2>
              <Link
                href="/track"
                className="inline-flex items-center gap-1 text-sm text-[#E6007A] hover:opacity-90"
              >
                Track all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="space-y-2">
              {recentTransfers.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-2 rounded-xl border border-white/[0.06] bg-[#1c1c26] p-4 text-sm md:grid-cols-5 md:items-center"
                >
                  <div className="font-mono text-xs text-[#6c9fff]">{item.id}</div>
                  <div className="text-[#f0f0f8]">{item.corridor}</div>
                  <div className="text-[#f0f0f8]">{item.amount}</div>
                  <div className="text-[#00e887]">{item.received}</div>
                  <div
                    className={`font-semibold ${
                      item.status === "Completed" ? "text-[#00e887]" : "text-[#f5c518]"
                    }`}
                  >
                    {item.status}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
