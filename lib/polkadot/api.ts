import { ApiPromise, WsProvider } from '@polkadot/api';
import type { SubmittableExtrinsic } from '@polkadot/api/types';
import type { Signer } from '@polkadot/types/types';
import { getActiveInjectedSigner } from './signer';

const RPC_ENDPOINTS = {
  polkadotRelay:    'wss://rpc.polkadot.io',
  polkaSendPara:    'wss://polkasend-rpc.example.com', // Replace with actual endpoint
  acalaPara:        'wss://acala-rpc.dwellir.com',
  assetHub:         'wss://sys.ibp.network/asset-hub-polkadot',
};

let apiInstance: ApiPromise | null = null;

export async function getPolkadotApi(endpoint = RPC_ENDPOINTS.polkaSendPara): Promise<ApiPromise> {
  if (apiInstance?.isConnected) return apiInstance;

  const provider = new WsProvider(endpoint);
  apiInstance = await ApiPromise.create({ provider });
  await apiInstance.isReady;
  return apiInstance;
}

// ─── Types matching our custom pallets ───────────────────────────────────────

export interface KycRecord {
  level: 'None' | 'BasicKyc' | 'FullKyc' | 'InstitutionalKyc';
  countryCode: string;
  approvedAt: number;
  annualLimitUsdCents: number;
  ytdSentUsdCents: number;
}

export interface RemittanceOrder {
  id: string;
  sender: string;
  recipient: string;
  assetId: number;
  amountIn: bigint;
  amountOutInrPaise: bigint;
  fxRateLocked: number;
  feePaise: bigint;
  deliveryMode: DeliveryMode;
  status: OrderStatus;
  createdAt: number;
  expiresAt: number;
}

export type DeliveryMode =
  | { type: 'CryptoWallet' }
  | { type: 'UpiInstant'; upiId: string }
  | { type: 'BankTransfer'; ifsc: string; accountNumber: string };

export type OrderStatus =
  | 'Initiated'
  | 'RateLocked'
  | 'CompliancePassed'
  | 'SettlementTriggered'
  | { Completed: { utrNumber: string } }
  | { Failed: { reason: string } };

// ─── Pallet query helpers ─────────────────────────────────────────────────────

export async function queryKycRecord(address: string): Promise<KycRecord | null> {
  const api = await getPolkadotApi();
  const result = await api.query['kyc']['kycRecords'](address);
  if (result.isEmpty) return null;
  return result.toJSON() as unknown as KycRecord;
}

export async function queryOrder(orderId: string): Promise<RemittanceOrder | null> {
  const api = await getPolkadotApi();
  const result = await api.query['remittance']['orders'](orderId);
  if (result.isEmpty) return null;
  return result.toJSON() as unknown as RemittanceOrder;
}

export async function queryFxRate(): Promise<number> {
  const api = await getPolkadotApi();
  const result = await api.query['rateLock']['currentRate']();
  return result.isEmpty ? 83_500_000 : (result.toJSON() as number);
}

// ─── Extrinsic builders ───────────────────────────────────────────────────────

export function buildInitiateRemittance(
  api: ApiPromise,
  recipientAddress: string,
  assetId: number,
  amount: bigint,
  deliveryMode: DeliveryMode,
): SubmittableExtrinsic<'promise'> {
  return api.tx['remittance']['initiateRemittance'](
    recipientAddress,
    assetId,
    amount,
    deliveryMode,
  );
}

export function buildSubmitKyc(
  api: ApiPromise,
  level: KycRecord['level'],
  countryCode: string,
  aadhaarHash: string | null,
  panHash: string | null,
): SubmittableExtrinsic<'promise'> {
  return api.tx['kyc']['submitKyc'](level, countryCode, aadhaarHash, panHash);
}

export interface SubmittedExtrinsicReceipt {
  txHash: string;
  status: string;
  blockHash?: string;
}

export async function submitWithInjectedSigner(
  extrinsic: SubmittableExtrinsic<'promise'>,
  address: string,
  signer: Signer | null = getActiveInjectedSigner(),
): Promise<SubmittedExtrinsicReceipt> {
  if (!signer) {
    throw new Error('No active injected signer is available for this wallet.');
  }

  return new Promise((resolve, reject) => {
    let unsub: (() => void) | undefined;

    extrinsic
      .signAndSend(address, { signer }, (result) => {
        if (result.dispatchError) {
          unsub?.();
          reject(new Error(result.dispatchError.toString()));
          return;
        }

        if (result.status.isInBlock || result.status.isFinalized) {
          const blockHash = result.status.isInBlock
            ? result.status.asInBlock.toHex()
            : result.status.asFinalized.toHex();

          unsub?.();
          resolve({
            txHash: extrinsic.hash.toHex(),
            status: result.status.type,
            blockHash,
          });
        }
      })
      .then((unsubscribe) => {
        unsub = unsubscribe;
      })
      .catch(reject);
  });
}

// ─── XCM helpers ─────────────────────────────────────────────────────────────

export const PARA_IDS = {
  polkaSend: 3000,
  acala:     2000,
  assetHub:  1000,
  moonbeam:  2004,
} as const;

export function buildXcmReserveTransfer(
  api: ApiPromise,
  destParaId: number,
  beneficiaryAddress: string,
  assetId: number,
  amount: bigint,
) {
  const dest = api.createType('XcmVersionedLocation', {
    V4: {
      parents: 1,
      interior: { X1: [{ Parachain: destParaId }] },
    },
  });

  const beneficiary = api.createType('XcmVersionedLocation', {
    V4: {
      parents: 0,
      interior: {
        X1: [{ AccountId32: { network: null, id: beneficiaryAddress } }],
      },
    },
  });

  const assets = api.createType('XcmVersionedAssets', {
    V4: [
      {
        id: { Concrete: { parents: 0, interior: { X2: [{ PalletInstance: 50 }, { GeneralIndex: assetId }] } } },
        fun: { Fungible: amount },
      },
    ],
  });

  return api.tx.polkadotXcm.reserveTransferAssets(dest, beneficiary, assets, 0);
}
