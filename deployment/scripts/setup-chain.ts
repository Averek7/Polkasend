import { ApiPromise, WsProvider } from "@polkadot/api";

async function main() {
  const relayWs = process.env.RELAYCHAIN_WS ?? "ws://localhost:9945";
  const paraWs = process.env.POLKASEND_WS ?? "ws://localhost:9944";
  const paraId = Number(process.env.PARA_ID ?? "3000");

  console.log(`[setup-chain] connecting relay chain: ${relayWs}`);
  const relayApi = await ApiPromise.create({ provider: new WsProvider(relayWs) });
  await relayApi.isReady;

  console.log(`[setup-chain] connecting parachain: ${paraWs}`);
  const paraApi = await ApiPromise.create({ provider: new WsProvider(paraWs) });
  await paraApi.isReady;

  const [relayHeader, paraHeader] = await Promise.all([
    relayApi.rpc.chain.getHeader(),
    paraApi.rpc.chain.getHeader(),
  ]);

  console.log(`[setup-chain] relay latest block: #${relayHeader.number.toString()}`);
  console.log(`[setup-chain] para latest block: #${paraHeader.number.toString()}`);
  console.log(`[setup-chain] target para id: ${paraId}`);
  console.log("[setup-chain] bootstrap checks complete.");

  await Promise.all([relayApi.disconnect(), paraApi.disconnect()]);
}

main().catch((error) => {
  console.error("[setup-chain] failed:", error);
  process.exit(1);
});
