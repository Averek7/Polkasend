"use client";

import { motion } from "framer-motion";

const STATS = [
  { label: "India remittances 2024", value: "$129B", sub: "World's largest recipient" },
  { label: "Protocol fee", value: "0.5%", sub: "vs 4–8% traditional" },
  { label: "Settlement time", value: "~36s", sub: "via UPI instant" },
  { label: "Annual savings potential", value: "$8B+", sub: "for Indian diaspora" },
];

export function HeroStats() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {STATS.map(({ label, value, sub }, i) => (
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
