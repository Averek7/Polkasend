import type { Signer } from "@polkadot/types/types";

let activeSigner: Signer | null = null;
let activeSignerSource: string | null = null;

export async function activateInjectedSigner(source: string): Promise<Signer> {
  const { web3FromSource } = await import("@polkadot/extension-dapp");
  const injector = await web3FromSource(source);

  if (!injector.signer) {
    throw new Error(`No signer was exposed by ${source}.`);
  }

  activeSigner = injector.signer as Signer;
  activeSignerSource = source;
  return activeSigner;
}

export async function ensureInjectedSigner(source: string): Promise<Signer> {
  if (activeSigner && activeSignerSource === source) {
    return activeSigner;
  }

  return activateInjectedSigner(source);
}

export function getActiveInjectedSigner(): Signer | null {
  return activeSigner;
}

export function clearActiveInjectedSigner() {
  activeSigner = null;
  activeSignerSource = null;
}

export function getActiveSignerSource(): string | null {
  return activeSignerSource;
}
