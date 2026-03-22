# Blind Vault

Privacy escrow primitive built on MagicBlock Private Ephemeral Rollups (PERs).

## What it does

Conditional payments where individual amounts are sealed inside a PER session
and never touch Solana L1. An on-chain observer can verify a vault exists and
its deadline — but cannot reconstruct who paid what.

## Why PERs are essential

Standard Solana programs expose all state on-chain. PERs provide ephemeral
state that is private, verifiable, and auto-destroyed after settlement.
This is architecturally impossible without PERs.

## Privacy guarantees

- Amount per payer: sealed in PER, never on L1
- Noise injection: dummy transactions mask timing patterns
- Trustless settlement: auto-executes on condition approval or deadline
- attack_feasible: false

## Demo flow

1. Three wallets commit amounts (sealed as hashes inside PER session)
2. Noise transactions injected — observer cannot distinguish real vs fake
3. Click "Simulate Chain Analysis Attack" → ATTACK FAILED
4. Approve condition → ephemeral state reveals for 1.5s → auto-settle
5. 250 USDC paid out, PER session destroyed

## Run locally

git clone https://github.com/oxkirisaki/blind-vault.git
cd blind-vault
npm install
npm run dev

Open http://localhost:5173

## Stack

React + TypeScript + Vite · Web Crypto API · MagicBlock PER SDK (devnet)

## Known edge cases (production roadmap)

- **Overcollateralization**: if total commits exceed target, excess is
  returned via pro-rata refund to each payer automatically
- **Partial fill**: configurable minimum threshold — vault can be set to
  settle at 80% of target, or strict 100% only
- **Timeout with partial commits**: if deadline passes and target not met,
  all committed amounts refund trustlessly via timelock
- **Collusion resistance**: vault creator has zero special privileges —
  cannot abort, redirect funds, or access sealed amounts before reveal

## Production roadmap

Abstract into single SDK call: `BlindVault.create(condition, deadline)`
so any developer can add privacy-preserving escrow in 10 lines of code.