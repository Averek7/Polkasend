"use client";

import { motion } from "framer-motion";

interface PolkaSendLogoProps {
  size?: number;
  animated?: boolean;
  showText?: boolean;
  className?: string;
}

export function PolkaSendLogo({
  size = 40,
  animated = true,
  showText = true,
  className = "",
}: PolkaSendLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* SVG Mark */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="dotGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ff4b9e" stopOpacity="1" />
              <stop offset="60%" stopColor="#E6007A" stopOpacity="1" />
              <stop offset="100%" stopColor="#9b005a" stopOpacity="1" />
            </radialGradient>
            <radialGradient id="orbitGlow1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6c9fff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#3a6bcc" stopOpacity="0.9" />
            </radialGradient>
            <radialGradient id="orbitGlow2" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#00e887" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#00a860" stopOpacity="0.9" />
            </radialGradient>
            <radialGradient id="orbitGlow3" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f5c518" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#cc9a00" stopOpacity="0.9" />
            </radialGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glowSmall" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Outer orbit ring */}
          {animated && (
            <motion.circle
              cx="50" cy="50" r="42"
              stroke="rgba(230,0,122,0.12)"
              strokeWidth="1"
              fill="none"
              strokeDasharray="6 4"
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              style={{ originX: "50px", originY: "50px" }}
            />
          )}

          {/* Middle orbit ring */}
          {animated && (
            <motion.circle
              cx="50" cy="50" r="32"
              stroke="rgba(230,0,122,0.08)"
              strokeWidth="1"
              fill="none"
              strokeDasharray="3 6"
              animate={{ rotate: -360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              style={{ originX: "50px", originY: "50px" }}
            />
          )}

          {/* Core pink dot */}
          <motion.circle
            cx="50" cy="50" r="18"
            fill="url(#dotGlow)"
            filter="url(#glow)"
            animate={animated ? {
              r: [18, 19.5, 18],
              filter: [
                "drop-shadow(0 0 6px rgba(230,0,122,0.7))",
                "drop-shadow(0 0 14px rgba(230,0,122,0.95))",
                "drop-shadow(0 0 6px rgba(230,0,122,0.7))",
              ],
            } : {}}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Arrow / send symbol inside core */}
          <motion.path
            d="M 43 50 L 57 50 M 52 44 L 58 50 L 52 56"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={animated ? { x: [0, 1.5, 0] } : {}}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Orbiting dot 1 — Blue (Relay Chain) */}
          {animated ? (
            <motion.circle
              cx="50" cy="18" r="5"
              fill="url(#orbitGlow1)"
              filter="url(#glowSmall)"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              style={{ originX: "50px", originY: "50px" }}
            />
          ) : (
            <circle cx="50" cy="18" r="5" fill="url(#orbitGlow1)" />
          )}

          {/* Orbiting dot 2 — Green (Acala/UPI) */}
          {animated ? (
            <motion.circle
              cx="50" cy="18" r="4"
              fill="url(#orbitGlow2)"
              filter="url(#glowSmall)"
              animate={{ rotate: -360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              style={{ originX: "50px", originY: "50px" }}
            />
          ) : (
            <circle cx="78" cy="68" r="4" fill="url(#orbitGlow2)" />
          )}

          {/* Orbiting dot 3 — Yellow (PST) */}
          {animated ? (
            <motion.circle
              cx="82" cy="50" r="3.5"
              fill="url(#orbitGlow3)"
              filter="url(#glowSmall)"
              animate={{ rotate: 360 }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear", delay: 3 }}
              style={{ originX: "50px", originY: "50px" }}
            />
          ) : (
            <circle cx="82" cy="50" r="3.5" fill="url(#orbitGlow3)" />
          )}
        </svg>
      </div>

      {/* Wordmark */}
      {showText && (
        <div
          className="flex items-baseline gap-0"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span
            style={{
              fontSize: size * 0.55,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "#f0f0f8",
              lineHeight: 1,
            }}
          >
            Polka
          </span>
          <span
            style={{
              fontSize: size * 0.55,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              background: "linear-gradient(135deg, #E6007A, #ff6eb5)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Send
          </span>
        </div>
      )}
    </div>
  );
}

/** Full-page hero version of the logo for loading screens / splash */
export function PolkaSendLogoHero({ size = 120 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ff4b9e" />
              <stop offset="55%" stopColor="#E6007A" />
              <stop offset="100%" stopColor="#7a0040" />
            </radialGradient>
            <filter id="heroGlowFilter" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Outer glow ring */}
          <motion.circle
            cx="60" cy="60" r="56"
            stroke="rgba(230,0,122,0.10)"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="8 5"
            animate={{ rotate: 360 }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            style={{ originX: "60px", originY: "60px" }}
          />

          {/* Second ring */}
          <motion.circle
            cx="60" cy="60" r="44"
            stroke="rgba(230,0,122,0.07)"
            strokeWidth="1"
            fill="none"
            strokeDasharray="4 8"
            animate={{ rotate: -360 }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            style={{ originX: "60px", originY: "60px" }}
          />

          {/* Core */}
          <motion.circle
            cx="60" cy="60" r="24"
            fill="url(#heroGlow)"
            filter="url(#heroGlowFilter)"
            animate={{
              r: [24, 26, 24],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Send arrow */}
          <motion.path
            d="M 51 60 L 69 60 M 63 53 L 70 60 L 63 67"
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ x: [0, 2, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Orbiting dots */}
          {[
            { color: "#6c9fff", r: 52, size: 7, dur: 8, delay: 0 },
            { color: "#00e887", r: 44, size: 5.5, dur: 11, delay: 2 },
            { color: "#f5c518", r: 52, size: 5, dur: 14, delay: 5 },
            { color: "#9b59d0", r: 44, size: 4.5, dur: 18, delay: 8 },
          ].map((dot, i) => (
            <motion.circle
              key={i}
              cx={60} cy={60 - dot.r}
              r={dot.size}
              fill={dot.color}
              style={{
                originX: "60px",
                originY: "60px",
                filter: `drop-shadow(0 0 4px ${dot.color})`,
              }}
              animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
              transition={{
                duration: dot.dur,
                repeat: Infinity,
                ease: "linear",
                delay: dot.delay,
              }}
            />
          ))}
        </svg>
      </div>

      {/* Hero wordmark */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{ fontFamily: "var(--font-display)" }}
        className="flex items-baseline"
      >
        <span className="text-5xl font-extrabold tracking-tight text-[#f0f0f8]" style={{ letterSpacing: "-0.04em" }}>
          Polka
        </span>
        <span
          className="text-5xl font-extrabold tracking-tight"
          style={{
            letterSpacing: "-0.04em",
            background: "linear-gradient(135deg, #E6007A, #ff6eb5)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Send
        </span>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-sm font-mono text-[#7070a0] tracking-widest uppercase"
      >
        Cross-Border Remittance · Polkadot Parachain
      </motion.p>
    </div>
  );
}
