'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useRemittanceStore } from '../../lib/polkadot/remittanceStore';
import { useWalletStore } from '../../lib/polkadot/walletStore';
import { useState, useEffect } from 'react';
import { CheckCircle, Loader2, Circle, XCircle } from 'lucide-react';

/* ─── Fee Breakdown ──────────────────────────────────────────────────────── */
export function FeeBreakdown() {
  const { sendAmount, fxRate, receiveAmountInr, sendCurrency } = useRemittanceStore();
  const amt     = parseFloat(sendAmount) || 0;
  const fee     = amt * 0.005;
  const net     = amt - fee;
  const bankFee = amt * 0.045;
  const saved   = (bankFee - fee) * fxRate;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl p-5"
      style={{ background: '#16161e', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="font-mono text-xs tracking-widest uppercase mb-4" style={{ color: '#7070a0' }}>
        Fee Breakdown
      </div>

      {[
        { label: 'Send amount',        value: `$${amt.toFixed(2)}`,       color: '#f0f0f8' },
        { label: 'Protocol fee (0.5%)',value: `-$${fee.toFixed(2)}`,      color: '#E6007A' },
        { label: 'FX spread',          value: '$0.00 ✓',                   color: '#00e887' },
        { label: 'Gas (PST)',          value: '~$0.05',                    color: '#00e887' },
      ].map(row => (
        <div key={row.label} className="flex justify-between items-center py-2.5 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.05)' }}
        >
          <span className="text-sm" style={{ color: '#7070a0' }}>{row.label}</span>
          <span className="text-sm font-semibold font-mono" style={{ color: row.color }}>{row.value}</span>
        </div>
      ))}

      <div className="flex justify-between items-center pt-3 mt-1">
        <span className="font-semibold">Recipient gets</span>
        <span className="text-lg font-black font-mono" style={{ color: '#00e887' }}>
          ₹{receiveAmountInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </span>
      </div>

      {saved > 0 && (
        <div className="mt-3 p-3 rounded-xl text-xs"
          style={{ background: 'rgba(0,232,135,0.06)', border: '1px solid rgba(0,232,135,0.12)', color: '#7070a0' }}
        >
          💸 vs bank wire: save{' '}
          <strong style={{ color: '#00e887' }}>
            ₹{Math.round(saved).toLocaleString('en-IN')}
          </strong>{' '}
          on this transfer
        </div>
      )}
    </motion.div>
  );
}

/* ─── XCM Route ─────────────────────────────────────────────────────────── */
export function XcmRoute() {
  const ROUTE = [
    { label: 'Moonbeam EVM',       color: '#6c9fff', sub: 'ERC-20 entry' },
    { label: 'AssetHub Para #1000', color: '#7070a0', sub: 'USDC reserve' },
    { label: 'Relay Chain',         color: '#E6007A', sub: 'XCMP routing' },
    { label: 'PolkaSend #3000',     color: '#E6007A', sub: 'pallet_remittance' },
    { label: 'Acala #2000',         color: '#9b59d0', sub: 'DEX → iINR' },
    { label: 'UPI Oracle',          color: '#00e887', sub: 'Fiat settlement' },
    { label: 'Recipient INR',       color: '#00e887', sub: '₹ delivered' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl p-5"
      style={{ background: '#16161e', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="font-mono text-xs tracking-widest uppercase mb-4" style={{ color: '#7070a0' }}>
        XCM Route
      </div>
      <div className="flex flex-col gap-0">
        {ROUTE.map((step, i) => (
          <div key={step.label} className="flex gap-3 items-start">
            <div className="flex flex-col items-center">
              <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                style={{ background: step.color, boxShadow: `0 0 6px ${step.color}88` }}
              />
              {i < ROUTE.length - 1 && (
                <div className="w-px flex-1 my-1" style={{ background: 'rgba(255,255,255,0.08)', minHeight: 16 }} />
              )}
            </div>
            <div className="pb-2">
              <div className="text-xs font-semibold" style={{ color: '#f0f0f8' }}>{step.label}</div>
              <div className="text-xs font-mono" style={{ color: '#7070a0' }}>{step.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Network Status ─────────────────────────────────────────────────────── */
export function NetworkStatus() {
  const { fxRate } = useRemittanceStore();
  const [block, setBlock]     = useState(21453271);
  const [paraBlock, setPara]  = useState(1034521);

  useEffect(() => {
    const t = setInterval(() => {
      setBlock(b => b + (Math.random() > 0.4 ? 1 : 0));
      setPara(p => p + 1);
    }, 6000);
    return () => clearInterval(t);
  }, []);

  const STATUS_ROWS = [
    { label: 'Relay chain block',   value: `#${block.toLocaleString()}`,    color: '#f0f0f8' },
    { label: 'Para block',          value: `#${paraBlock.toLocaleString()}`, color: '#f0f0f8' },
    { label: 'Active validators',   value: '297 / 300',                      color: '#00e887' },
    { label: 'USD/INR oracle',      value: `₹${fxRate.toFixed(2)}`,          color: '#00e887' },
    { label: 'Liquidity pool',      value: '$4.2M USDC',                     color: '#00e887' },
    { label: 'UPI oracle',          value: 'Online',                         color: '#00e887' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-2xl p-5"
      style={{ background: '#16161e', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-polka-green animate-pulse" />
        <div className="font-mono text-xs tracking-widest uppercase" style={{ color: '#7070a0' }}>
          Network Status
        </div>
      </div>
      {STATUS_ROWS.map(row => (
        <div key={row.label} className="flex justify-between py-2 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.05)' }}
        >
          <span className="text-xs" style={{ color: '#7070a0' }}>{row.label}</span>
          <span className="text-xs font-mono font-semibold" style={{ color: row.color }}>{row.value}</span>
        </div>
      ))}
    </motion.div>
  );
}

/* ─── KYC Banner ─────────────────────────────────────────────────────────── */
export function KycBanner() {
  const { address, connect } = useWalletStore();
  const [kyc, setKyc] = useState<'none' | 'pending' | 'approved'>('none');

  const handleKyc = () => {
    setKyc('pending');
    setTimeout(() => setKyc('approved'), 1500);
  };

  if (!address) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl mb-5 text-sm"
        style={{ background: '#1c1c26', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" style={{ boxShadow: '0 0 6px #ff4757' }} />
        <span style={{ color: '#7070a0' }}>Wallet not connected —</span>
        <button onClick={connect} className="text-polka-pink font-semibold hover:underline">
          Connect Wallet
        </button>
        <span className="ml-auto font-mono text-xs" style={{ color: '#7070a0' }}>KYC: NONE</span>
      </div>
    );
  }

  if (kyc === 'approved') {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl mb-5 text-sm"
        style={{ background: '#16161e', border: '1px solid rgba(0,232,135,0.2)' }}
      >
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse"
          style={{ background: '#00e887', boxShadow: '0 0 6px #00e887' }} />
        <span className="flex-1" style={{ color: '#7070a0' }}>
          KYC Verified — Full KYC · FEMA limit: $250,000/year
        </span>
        <span className="font-mono text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(0,232,135,0.1)', color: '#00e887' }}>
          FULL_KYC
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl mb-5 text-sm"
      style={{ background: '#1c1c26', border: '1px solid rgba(245,197,24,0.2)' }}
    >
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ background: '#f5c518', boxShadow: '0 0 6px #f5c518' }} />
      <span className="flex-1" style={{ color: '#7070a0' }}>
        {kyc === 'pending' ? 'Verifying KYC…' : 'KYC required to send —'}
      </span>
      {kyc === 'none' && (
        <button onClick={handleKyc} className="font-semibold" style={{ color: '#E6007A' }}>
          Verify Identity
        </button>
      )}
      <span className="ml-auto font-mono text-xs" style={{ color: '#7070a0' }}>
        {kyc === 'pending' ? 'PENDING' : 'NONE'}
      </span>
    </div>
  );
}

/* ─── Transaction Modal ──────────────────────────────────────────────────── */
const TX_STEPS = [
  'Submitting XCM to relay chain',
  'KYC & compliance check',
  'FX rate locked on-chain',
  'USDC → iINR swap on Acala',
  'Triggering UPI settlement',
  'On-chain receipt generated',
];

export function TransactionModal() {
  const { orderStatus, utrNumber, txHash, sendAmount, receiveAmountInr, reset } = useRemittanceStore();
  const [step, setStep]       = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const delays = [900, 700, 500, 1200, 1800, 600];
    let idx = 0;
    const advance = () => {
      if (idx >= TX_STEPS.length) return;
      setStep(idx);
      setProgress(Math.round(((idx + 1) / TX_STEPS.length) * 100));
      idx++;
      setTimeout(advance, delays[idx - 1] ?? 700);
    };
    advance();
  }, []);

  const done = step >= TX_STEPS.length - 1 && progress === 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}
      onClick={e => e.target === e.currentTarget && reset()}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full max-w-md rounded-3xl p-8 relative"
        style={{ background: '#16161e', border: '1px solid rgba(230,0,122,0.2)' }}
      >
        <button
          onClick={reset}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-polka-muted"
          style={{ background: '#1c1c26', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          ×
        </button>

        <h2 className="font-display font-black text-2xl mb-1">
          {done ? '✓ Transfer Complete!' : 'Processing…'}
        </h2>
        <p className="text-sm mb-6" style={{ color: '#7070a0' }}>
          {done
            ? 'INR delivered to recipient via UPI.'
            : 'Broadcasting to PolkaSend parachain via XCM…'}
        </p>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full mb-6 overflow-hidden" style={{ background: '#1c1c26' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: done ? '#00e887' : 'linear-gradient(90deg,#E6007A,#ff4b9e)' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-3 mb-6">
          {TX_STEPS.map((s, i) => {
            const state = i < step ? 'done' : i === step ? 'loading' : 'waiting';
            return (
              <div key={s} className="flex items-center gap-3 text-sm">
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                  {state === 'done'    && <CheckCircle size={18} style={{ color: '#00e887' }} />}
                  {state === 'loading' && <Loader2 size={18} style={{ color: '#E6007A' }} className="animate-spin" />}
                  {state === 'waiting' && <Circle size={18} style={{ color: '#7070a0' }} />}
                </div>
                <span style={{ color: state === 'waiting' ? '#7070a0' : '#f0f0f8' }}>{s}</span>
              </div>
            );
          })}
        </div>

        {/* Receipt */}
        <AnimatePresence>
          {done && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="rounded-xl p-4 font-mono text-xs leading-relaxed"
              style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {[
                ['order_id', txHash ? txHash.slice(0, 18) + '…' : '0xab12cd…'],
                ['amount_in', `${sendAmount} USDC`],
                ['amount_out', `₹${Math.round(receiveAmountInr).toLocaleString('en-IN')}`],
                ['fx_rate', '₹83.50 / USDC'],
                ['fee', '0.5%'],
                ['utr_number', utrNumber ?? 'HDFC' + Date.now().toString().slice(-12)],
                ['status', '✓ COMPLETED'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-4">
                  <span style={{ color: '#7070a0', minWidth: 96 }}>{k}:</span>
                  <span style={{ color: k === 'status' ? '#00e887' : '#E6007A' }}>{v}</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
