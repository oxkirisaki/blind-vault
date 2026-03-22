export interface VaultConfig {
  vaultId: string;
  targetAmount: number;    // dalam USDC (devnet)
  deadline: number;        // unix timestamp
  condition: string;       // deskripsi kondisi: "freelance delivery approved"
}

export async function createBlindVault(config: VaultConfig) {
  // Yang di-publish ke L1: hanya metadata tanpa amount breakdown
  const publicState = {
    vaultId: config.vaultId,
    deadline: config.deadline,
    condition: config.condition,
    status: "open",
    // targetAmount TIDAK di-publish — hanya diketahui peserta
  };

  // Simpan target di PER saja
  return publicState;
}

export function checkAutoSettle(
  vault: VaultConfig,
  totalCommitted: number
): "payout" | "refund" | "pending" {
  const now = Date.now() / 1000;

  if (totalCommitted >= vault.targetAmount) return "payout";
  if (now > vault.deadline) return "refund";
  return "pending";
}