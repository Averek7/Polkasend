'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { decodeAddress } from '@polkadot/util-crypto';
import { useRemittanceStore } from '../../lib/polkadot/remittanceStore';
import { useWalletStore } from '../../lib/polkadot/walletStore';
import { ArrowDown, Zap, Building2, Link2, Fingerprint } from 'lucide-react';

const CURRENCIES = ['USDC', 'USDT', 'DAI'] as const;

const DELIVERY_OPTS = [
  { id: 'upi',     icon: Zap,         label: 'UPI Instant',  speed: '~30 sec',  color: '#f5c518' },
  { id: 'imps',    icon: Building2,   label: 'IMPS / NEFT',  speed: '~2 min',   color: '#6c9fff' },
  { id: 'iinr',    icon: Link2,       label: 'iINR Wallet',  speed: '~6 sec',   color: '#00e887' },
  { id: 'aadhaar', icon: Fingerprint, label: 'Aadhaar Pay',  speed: '~45 sec',  color: '#E6007A' },
] as const;

export function SendForm() {
  const {
    sendAmount, sendCurrency, recipientId, deliveryMode, fxRate,
    receiveAmountInr, setSendAmount, setSendCurrency, setRecipientId,
    setDeliveryMode, submitRemittance,
  } = useRemittanceStore();
  const { address, connect } = useWalletStore();
  const [currIdx, setCurrIdx] = useState(0);

  const hasChainRecipient = (() => {
    try {
      decodeAddress(recipientId);
      return true;
    } catch {
      return false;
    }
  })();
  const usesDirectChainSubmission = deliveryMode === 'iinr' && hasChainRecipient;

  const handleCurrencyClick = () => {
    const next = (currIdx + 1) % CURRENCIES.length;
    setCurrIdx(next);
    setSendCurrency(CURRENCIES[next]);
  };

  const handleSend = async () => {
    if (!address) { connect(); return; }
    await submitRemittance(address);
  };

  const canSend = !!address && !!recipientId && parseFloat(sendAmount) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-6"
      style={{ background: '#16161e', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="font-mono text-xs tracking-widest uppercase mb-5"
        style={{ color: '#7070a0' }}>
        Initiate Remittance
      </div>

      {/* Send amount */}
      <div className="text-xs mb-2" style={{ color: '#7070a0' }}>You send</div>
      <div
        className="flex items-center gap-3 rounded-xl p-4 mb-3 transition-colors"
        style={{ background: '#1c1c26', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <input
          type="number"
          value={sendAmount}
          onChange={e => setSendAmount(e.target.value)}
          placeholder="200"
          className="flex-1 bg-transparent outline-none text-3xl font-black"
          style={{ fontFamily: 'var(--font-playfair)', color: '#f0f0f8', minWidth: 0 }}
        />
        <button
          onClick={handleCurrencyClick}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{ background: '#16161e', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f8', flexShrink: 0 }}
        >
          <span>{sendCurrency === 'USDC' ? '🇺🇸' : sendCurrency === 'USDT' ? '🌐' : '💠'}</span>
          {sendCurrency}
        </button>
      </div>

      {/* Rate arrow */}
      <div className="flex items-center gap-3 my-3">
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(230,0,122,0.3),transparent)' }} />
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono"
          style={{ background: 'rgba(0,232,135,0.08)', border: '1px solid rgba(0,232,135,0.15)', color: '#00e887' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-polka-green animate-pulse inline-block" />
          ₹{fxRate.toFixed(2)} / {sendCurrency}
        </div>
        <div className="flex items-center justify-center w-8 h-8 rounded-full cursor-pointer"
          style={{ background: '#1c1c26', border: '1px solid rgba(255,255,255,0.1)', color: '#E6007A' }}
        >
          <ArrowDown size={14} />
        </div>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg,rgba(230,0,122,0.3),transparent)' }} />
      </div>

      {/* Receive amount */}
      <div className="text-xs mb-2" style={{ color: '#7070a0' }}>Recipient gets</div>
      <div
        className="flex items-center gap-3 rounded-xl p-4 mb-5"
        style={{ background: 'rgba(0,232,135,0.03)', border: '1px solid rgba(0,232,135,0.12)' }}
      >
        <div className="flex-1 text-3xl font-black" style={{ fontFamily: 'var(--font-playfair)', color: '#00e887' }}>
          ₹{receiveAmountInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold flex-shrink-0"
          style={{ background: '#16161e', border: '1px solid rgba(255,255,255,0.07)', color: '#f0f0f8' }}
        >
          🇮🇳 INR
        </div>
      </div>

      {/* Recipient */}
      <div className="text-xs mb-2" style={{ color: '#7070a0' }}>Recipient UPI ID or wallet address</div>
      <input
        type="text"
        value={recipientId}
        onChange={e => setRecipientId(e.target.value)}
        placeholder="recipient@upi  or  5GrwvaEF…"
        className="w-full rounded-xl px-4 py-3 text-sm outline-none mb-5 transition-colors"
        style={{
          background: '#1c1c26',
          border: '1px solid rgba(255,255,255,0.07)',
          color: '#f0f0f8',
          fontFamily: 'var(--font-syne)',
        }}
      />

      {/* Delivery mode */}
      <div className="text-xs mb-3" style={{ color: '#7070a0' }}>Delivery method</div>
      <div className="grid grid-cols-2 gap-2 mb-6">
        {DELIVERY_OPTS.map(opt => {
          const selected = deliveryMode === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setDeliveryMode(opt.id as typeof deliveryMode)}
              className="flex flex-col items-center p-3 rounded-xl text-center transition-all"
              style={{
                background: selected ? `${opt.color}10` : '#1c1c26',
                border: `1px solid ${selected ? opt.color + '55' : 'rgba(255,255,255,0.07)'}`,
              }}
            >
              <opt.icon size={18} style={{ color: selected ? opt.color : '#7070a0', marginBottom: 4 }} />
              <span className="text-xs font-semibold" style={{ color: selected ? '#f0f0f8' : '#7070a0' }}>{opt.label}</span>
              <span className="text-xs mt-0.5" style={{ color: opt.color, fontFamily: 'var(--font-dm-mono)' }}>{opt.speed}</span>
            </button>
          );
        })}
      </div>

      <div
        className="mb-6 rounded-xl px-4 py-3 text-sm"
        style={{
          background: usesDirectChainSubmission
            ? 'rgba(0,232,135,0.06)'
            : 'rgba(108,159,255,0.06)',
          border: usesDirectChainSubmission
            ? '1px solid rgba(0,232,135,0.16)'
            : '1px solid rgba(108,159,255,0.16)',
          color: '#cfd3e6',
        }}
      >
        <div className="font-semibold mb-1" style={{ color: usesDirectChainSubmission ? '#00e887' : '#8db4ff' }}>
          {usesDirectChainSubmission ? 'Direct chain submission' : 'Backend-assisted settlement'}
        </div>
        <div style={{ color: '#8b8ba7' }}>
          {usesDirectChainSubmission
            ? 'This transfer will be signed from your connected Substrate wallet and submitted directly to the remittance pallet.'
            : deliveryMode === 'iinr'
            ? 'Use a valid Substrate recipient address to send this mode directly on-chain. Otherwise the app falls back to the backend flow.'
            : 'This delivery mode still routes through the backend settlement path while on-chain coverage is being expanded.'}
        </div>
      </div>

      {/* Send button */}
      <motion.button
        whileHover={canSend ? { scale: 1.02 } : {}}
        whileTap={canSend ? { scale: 0.98 } : {}}
        onClick={handleSend}
        disabled={!canSend}
        className="w-full py-4 rounded-xl font-bold text-base transition-all"
        style={
          canSend
            ? {
                background: 'linear-gradient(135deg,#E6007A,#ff4b9e)',
                color: 'white',
                boxShadow: '0 8px 30px rgba(230,0,122,0.3)',
              }
            : {
                background: '#1c1c26',
                color: '#7070a0',
                cursor: address ? 'not-allowed' : 'pointer',
              }
        }
      >
        {!address
          ? '🔗  Connect Wallet to Send'
          : !recipientId
          ? 'Enter recipient to continue'
          : usesDirectChainSubmission
          ? '🚀  Submit On-Chain via PolkaSend'
          : '🚀  Continue with PolkaSend'}
      </motion.button>
    </motion.div>
  );
}
