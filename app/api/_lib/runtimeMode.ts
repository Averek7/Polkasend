const backendBaseUrl = process.env.POLKASEND_BACKEND_URL ?? "http://localhost:4000";

function readBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

export function getApiRuntimeMode() {
  const backendEnabled = readBooleanEnv(
    process.env.POLKASEND_ENABLE_BACKEND_PROXY,
    false,
  );
  const contractsEnabled = readBooleanEnv(
    process.env.POLKASEND_ENABLE_CONTRACTS,
    false,
  );

  return {
    backendBaseUrl,
    backendEnabled,
    contractsEnabled,
    integrationMode: contractsEnabled
      ? "contracts"
      : backendEnabled
        ? "backend"
        : "web2-only",
  } as const;
}
