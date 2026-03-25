"use strict";
/**
 * Chain Event Watcher
 *
 * Subscribes to PolkaSend parachain events via WebSocket.
 * Watches for:
 *   - remittance.OrderCreated → trigger fiat settlement pipeline
 *   - remittance.RateLocked   → log for analytics
 *   - kyc.KycSubmitted        → notify KYC provider for review
 *
 * In production, this worker runs alongside the backend and
 * posts settlement confirmations back via pallet_fiat_bridge.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startChainWatcher = startChainWatcher;
exports.getChainStatus = getChainStatus;
const api_1 = require("@polkadot/api");
let api = null;
async function startChainWatcher() {
    const wsUrl = process.env.POLKASEND_WS;
    const provider = new api_1.WsProvider(wsUrl);
    api = await api_1.ApiPromise.create({ provider });
    console.log(`Chain watcher connected to ${wsUrl}`);
    // Subscribe to new blocks and parse events
    await api.rpc.chain.subscribeNewHeads(async (header) => {
        const blockHash = await api.rpc.chain.getBlockHash(header.number.toNumber());
        const events = await api.query.system.events.at(blockHash);
        events.forEach(async ({ event }) => {
            const { section, method, data } = event;
            // ── Remittance events ─────────────────────────────────────────────────
            if (section === "remittance") {
                if (method === "OrderCreated") {
                    const [orderId, sender, amountUsdc] = data;
                    console.log(`[ChainWatcher] OrderCreated: ${orderId} from ${sender}`);
                }
                if (method === "RateLocked") {
                    const [orderId, fxRate, inrAmount] = data;
                    console.log(`[ChainWatcher] RateLocked: ${orderId} @ ${fxRate} INR = ${inrAmount} paise`);
                    // Trigger off-chain UPI settlement pipeline
                    // await triggerUpiSettlement({
                    //   orderId: orderId.toHex(),
                    //   inrPaise: inrAmount.toBigInt(),
                    // });
                }
            }
            // ── KYC events ───────────────────────────────────────────────────────
            if (section === "kyc") {
                if (method === "KycSubmitted") {
                    const [account, level] = data;
                    console.log(`[ChainWatcher] KYC submitted: ${account} requesting ${level}`);
                    // Notify KYC provider via webhook
                }
            }
            // ── FiatBridge events ─────────────────────────────────────────────────
            if (section === "fiatBridge") {
                if (method === "UpiPaymentConfirmed") {
                    const [orderId, utrNumber, amountPaise] = data;
                    console.log(`[ChainWatcher] UPI confirmed: ${orderId} UTR=${utrNumber}`);
                }
            }
        });
    });
}
async function getChainStatus() {
    if (!api)
        return null;
    const [finalizedHead, header] = await Promise.all([
        api.rpc.chain.getFinalizedHead(),
        api.rpc.chain.getHeader(),
    ]);
    return {
        paraBlock: header.number.toNumber(),
        isConnected: api.isConnected,
        genesisHash: api.genesisHash.toHex(),
    };
}
