'use client';

import { motion } from 'framer-motion';

interface PolkaSendLogoProps {
  size?: number;
  showText?: boolean;
  animate?: boolean;
  className?: string;
}

export function PolkaSendLogo({
  size = 40,
  showText = true,
  animate = true,
  className = '',
}: PolkaSendLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Animated SVG Logo Mark */}
      <div style={{ width: size, height: size }} className="relative flex-shrink-0">
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%"  stopColor="#E6007A" stopOpacity="1" />
              <stop offset="60%" stopColor="#E6007A" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#b8005f" stopOpacity="0.6" />
            </radialGradient>
            <radialGradient id="outer-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%"  stopColor="#E6007A" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#E6007A" stopOpacity="0" />
            </radialGradient>
            <filter id="blur-glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Outer glow ring */}
          {animate && (
            <motion.circle
              cx="50" cy="50" r="46"
              fill="url(#outer-glow)"
              animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}

          {/* Orbit ring 1 */}
          {animate ? (
            <motion.ellipse
              cx="50" cy="50"
              rx="44" ry="18"
              stroke="#E6007A" strokeWidth="1.5"
              strokeDasharray="6 4"
              fill="none"
              opacity="0.35"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              style={{ originX: '50px', originY: '50px' }}
            />
          ) : (
            <ellipse cx="50" cy="50" rx="44" ry="18"
              stroke="#E6007A" strokeWidth="1.5" strokeDasharray="6 4"
              fill="none" opacity="0.35"
            />
          )}

          {/* Orbit ring 2 — tilted */}
          {animate ? (
            <motion.ellipse
              cx="50" cy="50"
              rx="44" ry="18"
              stroke="#E6007A" strokeWidth="1"
              strokeDasharray="3 6"
              fill="none"
              opacity="0.2"
              animate={{ rotate: -360 }}
              transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
              style={{
                originX: '50px', originY: '50px',
                transform: 'rotate(60deg)',
              }}
            />
          ) : (
            <ellipse cx="50" cy="50" rx="44" ry="18"
              stroke="#E6007A" strokeWidth="1" strokeDasharray="3 6"
              fill="none" opacity="0.2"
              style={{ transform: 'rotate(60deg)', transformOrigin: '50px 50px' }}
            />
          )}

          {/* Orbit dot — traveling around ring 1 */}
          {animate && (
            <motion.circle
              r="3.5" fill="#E6007A"
              filter="url(#blur-glow)"
              animate={{
                cx: [94, 50, 6, 50, 94],
                cy: [50, 68, 50, 32, 50],
              }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />
          )}

          {/* Orbit dot 2 */}
          {animate && (
            <motion.circle
              r="2.5" fill="#ff4b9e"
              opacity="0.7"
              animate={{
                cx: [6, 50, 94, 50, 6],
                cy: [50, 68, 50, 32, 50],
              }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear', delay: 4 }}
            />
          )}

          {/* Core dot */}
          {animate ? (
            <motion.circle
              cx="50" cy="50" r="16"
              fill="url(#core-glow)"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          ) : (
            <circle cx="50" cy="50" r="16" fill="url(#core-glow)" />
          )}

          {/* DOT symbol in center — arrow / send icon */}
          <motion.path
            d="M42 50 L54 43 L54 47 L62 47 L62 53 L54 53 L54 57 Z"
            fill="white"
            opacity="0.95"
            animate={animate ? { opacity: [0.85, 1, 0.85] } : undefined}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </svg>
      </div>

      {/* Wordmark */}
      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className="font-display font-black tracking-tight"
            style={{ fontSize: size * 0.52, lineHeight: 1 }}
          >
            <span style={{ color: '#f0f0f8' }}>Polka</span>
            <span style={{ color: '#E6007A' }}>Send</span>
          </span>
          <span
            className="font-mono tracking-widest uppercase"
            style={{
              fontSize: size * 0.19,
              color: '#7070a0',
              letterSpacing: '0.14em',
              marginTop: size * 0.04,
            }}
          >
            Polkadot Remittance
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── Large Hero Logo Variant ─── */
export function PolkaSendLogoHero() {
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Big animated orb */}
      <div className="relative w-32 h-32">
        {/* Outermost pulse */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: 'rgba(230,0,122,0.08)' }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-2 rounded-full"
          style={{ background: 'rgba(230,0,122,0.12)' }}
          animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0.1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
        />

        {/* Main SVG */}
        <svg width="128" height="128" viewBox="0 0 100 100" fill="none" className="relative z-10">
          <defs>
            <radialGradient id="hero-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%"  stopColor="#ff4b9e" />
              <stop offset="100%" stopColor="#E6007A" />
            </radialGradient>
            <filter id="hero-glow">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* 3 orbit rings */}
          <motion.ellipse cx="50" cy="50" rx="46" ry="16" stroke="#E6007A" strokeWidth="1.5"
            strokeDasharray="8 4" fill="none" opacity="0.4"
            animate={{ rotate: 360 }}
            transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
            style={{ originX: '50px', originY: '50px' }}
          />
          <motion.ellipse cx="50" cy="50" rx="46" ry="16" stroke="#ff4b9e" strokeWidth="1"
            strokeDasharray="4 8" fill="none" opacity="0.25"
            animate={{ rotate: -360 }}
            transition={{ duration: 11, repeat: Infinity, ease: 'linear' }}
            style={{ originX: '50px', originY: '50px', transform: 'rotate(55deg)' }}
          />
          <motion.ellipse cx="50" cy="50" rx="46" ry="16" stroke="#E6007A" strokeWidth="0.8"
            strokeDasharray="2 10" fill="none" opacity="0.2"
            animate={{ rotate: 360 }}
            transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
            style={{ originX: '50px', originY: '50px', transform: 'rotate(-55deg)' }}
          />

          {/* Traveling dots */}
          {[0, 4, 8].map((delay, i) => (
            <motion.circle key={i} r={3.5 - i * 0.8} fill="#E6007A" opacity={1 - i * 0.25}
              filter="url(#hero-glow)"
              animate={{ cx: [94,50,6,50,94], cy: [50,66,50,34,50] }}
              transition={{ duration: 7, repeat: Infinity, ease: 'linear', delay }}
            />
          ))}

          {/* Core */}
          <motion.circle cx="50" cy="50" r="18" fill="url(#hero-core)"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Send arrow */}
          <motion.path
            d="M41 50 L55 42 L55 46.5 L64 46.5 L64 53.5 L55 53.5 L55 58 Z"
            fill="white" opacity="0.95"
            animate={{ opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
        </svg>
      </div>

      <div className="text-center">
        <h1 className="font-display font-black text-6xl tracking-tight leading-none">
          <span className="text-polka-text">Polka</span>
          <span className="text-polka-pink">Send</span>
        </h1>
        <p className="font-mono text-xs tracking-[0.25em] text-polka-muted uppercase mt-2">
          Cross-Border Remittance · Polkadot Parachain
        </p>
      </div>
    </div>
  );
}
