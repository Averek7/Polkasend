'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { PolkaSendLogoHero } from '@/components/logo/PolkaSendLogo';
import { ArrowRight, Zap, Shield, Globe, TrendingDown } from 'lucide-react';

const STATS = [
  { value: '$129B', label: 'India remittances 2024', color: '#E6007A' },
  { value: '0.5%',  label: 'Protocol fee (vs 4–8%)', color: '#00e887' },
  { value: '~36s',  label: 'End-to-end settlement', color: '#6c9fff' },
  { value: '$5B+',  label: 'Annual savings potential', color: '#f5c518' },
];

const FEATURES = [
  {
    icon: Zap,
    title: 'Near-Instant Settlement',
    desc: 'Polkadot\'s 6-second finality + UPI delivers INR in ~36 seconds. Not hours. Not days.',
    color: '#f5c518',
  },
  {
    icon: TrendingDown,
    title: 'Under 0.5% Fee',
    desc: 'Zero FX spread. Zero hidden fees. Protocol fee of 0.5% — 8x cheaper than banks.',
    color: '#00e887',
  },
  {
    icon: Shield,
    title: 'RBI-Compliant KYC',
    desc: 'Fully compliant with FEMA, FATF Travel Rule, and RBI Master Directions. On-chain audit trail.',
    color: '#E6007A',
  },
  {
    icon: Globe,
    title: 'Powered by XCM',
    desc: 'Cross-chain messaging routes liquidity via Acala DEX. Multi-corridor: USA, UAE, UK, Canada.',
    color: '#6c9fff',
  },
];

const CORRIDORS = [
  { from: '🇺🇸 USA',    to: '🇮🇳 India', vol: '$52B/yr', fee: '0.5%' },
  { from: '🇦🇪 UAE',    to: '🇮🇳 India', vol: '$18B/yr', fee: '0.5%' },
  { from: '🇬🇧 UK',     to: '🇮🇳 India', vol: '$6B/yr',  fee: '0.5%' },
  { from: '🇨🇦 Canada', to: '🇮🇳 India', vol: '$4B/yr',  fee: '0.5%' },
];

const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>
      <Navbar />

      {/* ── BG grid + orb ── */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(230,0,122,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(230,0,122,0.04) 1px,transparent 1px)',
          backgroundSize: '60px 60px',
          zIndex: 0,
        }}
      />
      <div
        className="fixed pointer-events-none"
        style={{
          top: '-200px', right: '-200px',
          width: '700px', height: '700px',
          background: 'radial-gradient(circle, rgba(230,0,122,0.1) 0%, transparent 70%)',
          zIndex: 0,
        }}
      />
      <div
        className="fixed pointer-events-none"
        style={{
          bottom: '-300px', left: '-200px',
          width: '600px', height: '600px',
          background: 'radial-gradient(circle, rgba(108,159,255,0.06) 0%, transparent 70%)',
          zIndex: 0,
        }}
      />

      <main className="relative z-10">
        {/* ── HERO ── */}
        <section className="pt-36 pb-20 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mb-10"
            >
              <PolkaSendLogoHero />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
              style={{
                background: 'rgba(230,0,122,0.06)',
                border: '1px solid rgba(230,0,122,0.2)',
                fontFamily: 'var(--font-dm-mono)',
                fontSize: '0.75rem',
                color: '#E6007A',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-polka-pink animate-pulse" />
              Polkadot Parachain #3000 · Substrate FRAME · XCM v4
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="font-display font-black text-5xl md:text-7xl leading-tight tracking-tight mb-6"
            >
              Send money to India
              <br />
              <span style={{ color: '#E6007A' }}>for under 0.5%</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
              style={{ color: '#7070a0' }}
            >
              A purpose-built parachain on Polkadot for cross-border remittance.
              Near-instant settlement via UPI. Fully KYC/AML compliant.
              Built with custom FRAME pallets and XCM.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="flex items-center justify-center gap-4 flex-wrap"
            >
              <Link href="/send">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white"
                  style={{
                    background: 'linear-gradient(135deg,#E6007A,#ff4b9e)',
                    boxShadow: '0 8px 30px rgba(230,0,122,0.35)',
                    fontSize: '1rem',
                  }}
                >
                  Send Money Now <ArrowRight size={18} />
                </motion.button>
              </Link>
              <Link href="/architecture">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold"
                  style={{
                    background: 'rgba(22,22,30,0.8)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#f0f0f8',
                    fontSize: '1rem',
                  }}
                >
                  View Architecture
                </motion.button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* ── STATS ── */}
        <section className="px-6 pb-16">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1 overflow-hidden rounded-2xl"
              style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
            >
              {STATS.map((s, i) => (
                <motion.div
                  key={s.label}
                  custom={i}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="p-6 md:p-8 text-center"
                  style={{ background: '#16161e', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.07)' : undefined }}
                >
                  <div className="font-display font-black text-3xl md:text-4xl mb-1" style={{ color: s.color }}>
                    {s.value}
                  </div>
                  <div className="text-xs" style={{ color: '#7070a0' }}>{s.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section className="px-6 pb-20">
          <div className="max-w-5xl mx-auto">
            <motion.div
              custom={0}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h3 className="font-display font-black text-3xl md:text-4xl mb-4">
                Why PolkaSend
              </h3>
              <p style={{ color: '#7070a0' }}>Built different. Designed for India's $129B remittance market.</p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-4">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  custom={i}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="p-6 rounded-2xl"
                  style={{
                    background: '#16161e',
                    border: '1px solid rgba(255,255,255,0.07)',
                    transition: 'border-color 0.2s',
                  }}
                  whileHover={{ borderColor: `${f.color}44` }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `${f.color}14` }}
                  >
                    <f.icon size={20} style={{ color: f.color }} />
                  </div>
                  <h4 className="font-bold text-lg mb-2">{f.title}</h4>
                  <p className="text-sm leading-relaxed" style={{ color: '#7070a0' }}>{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CORRIDORS ── */}
        <section className="px-6 pb-20">
          <div className="max-w-5xl mx-auto">
            <motion.div
              custom={0} variants={fadeUp}
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              className="text-center mb-10"
            >
              <h3 className="font-display font-black text-3xl md:text-4xl mb-4">Active Corridors</h3>
            </motion.div>
            <div className="grid md:grid-cols-4 gap-4">
              {CORRIDORS.map((c, i) => (
                <motion.div
                  key={c.from}
                  custom={i} variants={fadeUp}
                  initial="hidden" whileInView="visible" viewport={{ once: true }}
                  className="p-5 rounded-xl text-center"
                  style={{ background: '#16161e', border: '1px solid rgba(255,255,255,0.07)' }}
                  whileHover={{ borderColor: 'rgba(230,0,122,0.3)' }}
                >
                  <div className="text-sm font-semibold mb-1">{c.from}</div>
                  <div className="text-polka-muted text-xl my-2">↓</div>
                  <div className="text-sm font-semibold mb-3">{c.to}</div>
                  <div className="font-mono text-xs" style={{ color: '#7070a0' }}>{c.vol}</div>
                  <div
                    className="mt-2 inline-block px-3 py-1 rounded-full font-mono text-xs font-bold"
                    style={{ background: 'rgba(0,232,135,0.1)', color: '#00e887' }}
                  >
                    {c.fee} fee
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="px-6 pb-24">
          <div className="max-w-2xl mx-auto text-center">
            <motion.div
              custom={0} variants={fadeUp}
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              className="p-10 rounded-3xl"
              style={{
                background: 'linear-gradient(135deg, rgba(230,0,122,0.08), rgba(108,159,255,0.05))',
                border: '1px solid rgba(230,0,122,0.2)',
              }}
            >
              <h3 className="font-display font-black text-3xl mb-4">Ready to send?</h3>
              <p className="mb-8" style={{ color: '#7070a0' }}>
                Connect your Polkadot wallet and send your first remittance in under 2 minutes.
              </p>
              <Link href="/send">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-10 py-4 rounded-xl font-bold text-white"
                  style={{
                    background: 'linear-gradient(135deg,#E6007A,#ff4b9e)',
                    boxShadow: '0 8px 30px rgba(230,0,122,0.4)',
                  }}
                >
                  Launch App →
                </motion.button>
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t px-6 py-8 text-center"
        style={{ borderColor: 'rgba(255,255,255,0.06)', color: '#7070a0' }}
      >
        <div className="font-mono text-xs">
          PolkaSend · Built on Polkadot · Parachain #3000 · XCM v4 · Substrate FRAME
        </div>
      </footer>
    </div>
  );
}
