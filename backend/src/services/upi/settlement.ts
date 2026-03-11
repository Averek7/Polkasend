export interface SettlementRequest {
  orderId: string;
  inrPaise: bigint;
}

export async function triggerUpiSettlement(
  _request: SettlementRequest,
): Promise<{ accepted: boolean }> {
  // Stub for local/dev deployment. In production this calls banking rails.
  return { accepted: true };
}
