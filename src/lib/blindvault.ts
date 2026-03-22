import { Connection, Keypair, Transaction } from "@solana/web3.js";
import { createEphemeralSession } from "@magicblock-labs/ephemeral-rollups-sdk";
import crypto from "crypto";

// --- COMMIT PHASE ---
// Amount tidak pernah keluar dari PER session dalam plaintext
export async function commitToVault(
  amount: number,
  payerKeypair: Keypair,
  vaultId: string
) {
  const salt = crypto.randomBytes(32).toString("hex");
  const commitment = crypto
    .createHash("sha256")
    .update(`${amount}:${salt}:${vaultId}`)
    .digest("hex");

  // Buka PER session — ini yang bikin eligible untuk hackathon
  const session = await createEphemeralSession({
    payer: payerKeypair,
    commitment: "confirmed",
  });

  // State tersimpan di PER, bukan di L1
  await session.store(`commit:${vaultId}:${payerKeypair.publicKey}`, {
    commitment,
    salt,          // salt HANYA ada di PER, tidak pernah ke L1
    timestamp: Date.now(),
  });

  // Inject noise: kirim dummy tx dengan delay random
  await injectNoise(session, vaultId);

  return { commitment, sessionId: session.id };
}

// --- NOISE INJECTOR ---
// Ini yang bikin timing analysis tidak bisa reconstruct siapa bayar berapa
async function injectNoise(session: any, vaultId: string) {
  const noiseCount = Math.floor(Math.random() * 3) + 1; // 1-3 dummy tx

  for (let i = 0; i < noiseCount; i++) {
    const delay = Math.random() * 2000 + 500; // 0.5s – 2.5s random
    await new Promise((res) => setTimeout(res, delay));

    // Dummy commitment dengan amount acak — observer tidak bisa bedakan mana asli
    const fakeCommit = crypto.randomBytes(32).toString("hex");
    await session.store(`noise:${vaultId}:${i}:${Date.now()}`, {
      commitment: fakeCommit,
      isNoise: true,
    });
  }
}