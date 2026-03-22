import { useState, useEffect, useRef } from "react";

// ─── CRYPTO ───────────────────────────────────────────────────────────────────

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

function randomSalt(): string {
  const arr = new Uint8Array(8);
  window.crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

type VaultStatus = "open" | "settling" | "paid" | "refunded";
type WalletId = "payer_a" | "payer_b" | "payer_c";
type RevealPhase = "sealed" | "revealing" | "done";

interface Commit {
  walletId: string;
  commitment: string;
  timestamp: number;
  isNoise: boolean;
}

interface Vault {
  id: string;
  condition: string;
  deadline: number;
  status: VaultStatus;
  totalLocked: number;
  commits: Commit[];
}

interface WalletState {
  id: WalletId;
  label: string;
  amount: number;
  committed: boolean;
  salt: string;
  commitment: string;
}

// ─── SCANLINE ─────────────────────────────────────────────────────────────────

function Scanline() {
  return (
    <div style={{
      position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999,
      backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.025) 2px,rgba(0,0,0,0.025) 4px)",
    }} />
  );
}

// ─── STATUS PILL ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: VaultStatus }) {
  const map: Record<VaultStatus, { label: string; color: string }> = {
    open:     { label: "OPEN",     color: "#00ff88" },
    settling: { label: "SETTLING", color: "#ffcc00" },
    paid:     { label: "PAID OUT", color: "#00ccff" },
    refunded: { label: "REFUNDED", color: "#ff6644" },
  };
  const { label, color } = map[status];
  return (
    <span style={{
      fontFamily: "monospace", fontSize: 11, letterSpacing: 2, color,
      border: `1px solid ${color}55`, padding: "2px 10px", borderRadius: 2,
    }}>
      {label}
    </span>
  );
}

// ─── WALLET CARD (with reveal animation) ─────────────────────────────────────

function WalletCard({
  wallet, onCommit, disabled, revealPhase,
}: {
  wallet: WalletState;
  onCommit: (id: WalletId, amount: number) => void;
  disabled: boolean;
  revealPhase: RevealPhase;
}) {
  const [localAmt, setLocalAmt] = useState(wallet.amount);
  const [flicker, setFlicker] = useState(false);

  useEffect(() => {
    if (revealPhase !== "revealing") { setFlicker(false); return; }
    const iv = setInterval(() => setFlicker((f) => !f), 110);
    return () => clearInterval(iv);
  }, [revealPhase]);

  const isRevealing = revealPhase === "revealing";
  const borderColor = isRevealing ? "#ffcc0066" : wallet.committed ? "#00ff8833" : "#0d1f0d";
  const bgColor     = isRevealing ? "#0e0e00"   : wallet.committed ? "#020f05"   : "#050e05";

  return (
    <div style={{
      border: `1px solid ${borderColor}`,
      borderRadius: 8, padding: 16, background: bgColor,
      transition: "border-color 0.3s, background 0.3s",
      position: "relative", overflow: "hidden",
    }}>
      {/* accent line */}
      {(wallet.committed || isRevealing) && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: isRevealing
            ? "linear-gradient(90deg,transparent,#ffcc0088,transparent)"
            : "linear-gradient(90deg,transparent,#00ff8866,transparent)",
        }} />
      )}

      <div style={{ fontSize: 9, color: "#2a5a2a", letterSpacing: 3, marginBottom: 6 }}>
        WALLET / {wallet.id.replace("_", "-").toUpperCase()}
      </div>

      <div style={{
        fontSize: 20, fontWeight: 700, fontFamily: "monospace", marginBottom: 12,
        color: isRevealing ? (flicker ? "#ffcc00" : "#4a4a00") : wallet.committed ? "#00ff88" : "#4a8a4a",
        transition: "color 0.05s",
      }}>
        {wallet.committed
          ? isRevealing
            ? flicker ? `${wallet.label} — REVEALED` : `${wallet.label} ✓`
            : `${wallet.label} ✓`
          : wallet.label}
      </div>

      {!wallet.committed ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ color: "#2a5a2a", fontFamily: "monospace", fontSize: 12 }}>USDC</span>
            <input
              type="number" value={localAmt}
              onChange={(e) => setLocalAmt(Math.max(1, Number(e.target.value)))}
              style={{
                background: "#0a150a", border: "1px solid #1a3a1a", borderRadius: 4,
                color: "#88cc88", fontFamily: "monospace", fontSize: 16,
                padding: "4px 10px", width: 90, outline: "none",
              }}
              min={1} max={9999}
            />
          </div>
          <div style={{ fontSize: 10, color: "#1a4a1a", fontFamily: "monospace", marginBottom: 10 }}>
            amount stays in PER — never touches L1
          </div>
          <button
            onClick={() => onCommit(wallet.id, localAmt)} disabled={disabled}
            style={{
              width: "100%", background: disabled ? "#0a130a" : "#001808",
              border: `1px solid ${disabled ? "#1a2a1a" : "#00ff8855"}`,
              borderRadius: 4, color: disabled ? "#2a4a2a" : "#00ff88",
              fontFamily: "monospace", fontSize: 12, letterSpacing: 2,
              padding: "8px 0", cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            COMMIT →
          </button>
        </>
      ) : (
        <div style={{ fontFamily: "monospace", fontSize: 11, lineHeight: 1.7 }}>
          <div style={{ color: "#2a6a2a" }}>salt: {wallet.salt}</div>
          <div style={{
            color: isRevealing && flicker ? "#ffcc00" : "#1a5a1a",
            transition: "color 0.05s",
          }}>
            amount:{" "}
            <span style={{
              color: isRevealing && flicker ? "#ffcc00" : "#3a7a3a",
              fontWeight: isRevealing && flicker ? 700 : 400,
            }}>
              {isRevealing && flicker ? `${wallet.amount} USDC` : "[sealed in PER]"}
            </span>
          </div>
          <div style={{ color: "#1a4a1a", marginTop: 2 }}>hash: {wallet.commitment}...</div>
        </div>
      )}
    </div>
  );
}

// ─── ATTACK SIMULATOR ─────────────────────────────────────────────────────────

function AttackSimulator({ commits }: { commits: Commit[] }) {
  const [phase, setPhase] = useState<"idle" | "scanning" | "failed">("idle");
  const [scanLine, setScanLine] = useState(0);

  const steps = [
    "Fetching on-chain transaction log...",
    "Indexing commit hashes by timestamp...",
    "Running timing correlation analysis...",
    "Attempting amount inference from tx gaps...",
    "Cross-referencing wallet signatures...",
    "Applying clustering algorithm...",
    "ATTACK FAILED",
  ];

  async function runAttack() {
    if (phase !== "idle" || commits.length === 0) return;
    setPhase("scanning");
    for (let i = 0; i < steps.length; i++) {
      await new Promise((r) => setTimeout(r, 270));
      setScanLine(i);
    }
    setPhase("failed");
  }

  const noiseCount = commits.filter((c) => c.isNoise).length;
  const realCount  = commits.filter((c) => !c.isNoise).length;

  return (
    <div style={{ marginTop: 10 }}>
      {phase === "idle" && (
        <button
          onClick={runAttack}
          disabled={commits.length === 0}
          style={{
            width: "100%", background: "#0e0500",
            border: "1px solid #ff664422", borderRadius: 4,
            color: commits.length === 0 ? "#3a1a0a" : "#ff6644",
            fontFamily: "monospace", fontSize: 11, letterSpacing: 1,
            padding: "7px 0", cursor: commits.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          SIMULATE CHAIN ANALYSIS ATTACK
        </button>
      )}

      {phase === "scanning" && (
        <div style={{
          background: "#0a0300", border: "1px solid #ff664433",
          borderRadius: 4, padding: "10px 12px",
          fontFamily: "monospace", fontSize: 10, lineHeight: 1.85,
        }}>
          {steps.slice(0, scanLine + 1).map((msg, i) => (
            <div key={i} style={{
              color: i === steps.length - 1 ? "#ff2200"
                   : i === scanLine ? "#ff9944"
                   : "#3a1a0a",
            }}>
              {i < scanLine ? "✓ " : i === scanLine ? "> " : "  "}{msg}
            </div>
          ))}
        </div>
      )}

      {phase === "failed" && (
        <div style={{
          background: "#0a0200", border: "1px solid #ff220033",
          borderRadius: 4, padding: "12px 14px",
          fontFamily: "monospace", fontSize: 11, lineHeight: 1.85,
        }}>
          <div style={{ color: "#ff2200", fontSize: 13, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
            ATTACK FAILED
          </div>
          {[
            ["signals detected",         `${commits.length} tx`,          "#ff6644"],
            ["noise injection",          `${noiseCount} dummy tx confirmed`, "#ff6644"],
            ["real commits identifiable","NO",                             "#ff2200"],
            ["timing variance",          "HIGH — pattern unresolvable",   "#ff6644"],
          ].map(([k, v, c]) => (
            <div key={k as string} style={{ color: "#5a2a1a" }}>
              {k as string}:{" "}
              <span style={{ color: c as string }}>{v as string}</span>
            </div>
          ))}
          <div style={{
            marginTop: 8, padding: "6px 8px",
            background: "#0e0200", border: "1px solid #ff220022",
            borderRadius: 3, color: "#ff4422", fontSize: 10, lineHeight: 1.6,
          }}>
            Attempt failed: {noiseCount} dummy transactions detected,
            actual distribution among {realCount} real commits remains indeterminate.
          </div>
          <button
            onClick={() => { setPhase("idle"); setScanLine(0); }}
            style={{
              marginTop: 8, background: "transparent", border: "none",
              color: "#3a1a0a", fontFamily: "monospace", fontSize: 10,
              cursor: "pointer", textDecoration: "underline",
            }}
          >
            reset
          </button>
        </div>
      )}
    </div>
  );
}

// ─── COMMIT LOG ───────────────────────────────────────────────────────────────

function CommitLog({ commits }: { commits: Commit[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [commits]);

  return (
    <div style={{
      background: "#030c03", border: "1px solid #0d1f0d", borderRadius: 6,
      padding: 12, fontFamily: "monospace", fontSize: 11, color: "#3a7a3a",
      height: 148, overflowY: "auto", lineHeight: 1.75,
    }}>
      <div style={{ color: "#1a4a1a", marginBottom: 6 }}>// PER session log — ephemeral state</div>
      {commits.length === 0 && <div style={{ color: "#1a3a1a" }}>awaiting commits...</div>}
      {commits.map((c, i) => (
        <div key={i} style={{ color: c.isNoise ? "#1a3a1a" : "#55aa55" }}>
          <span style={{ color: c.isNoise ? "#1a2a1a" : "#2a6a2a" }}>
            [{new Date(c.timestamp).toLocaleTimeString()}]
          </span>{" "}
          <span style={{ color: c.isNoise ? "#223322" : "#44aa44" }}>commit:</span>{" "}
          {c.commitment}
          {c.isNoise && <span style={{ color: "#1a2a1a" }}> ← noise</span>}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

// ─── OBSERVER PANEL ───────────────────────────────────────────────────────────

function ObserverPanel({ vault, commits }: { vault: Vault; commits: Commit[] }) {
  const noiseCount = commits.filter((c) => c.isNoise).length;
  const totalVisible = commits.length;

  const rows = [
    { k: "VAULT ID",       v: vault.id,           visible: true },
    { k: "CONDITION",      v: vault.condition,     visible: true },
    { k: "STATUS",         v: vault.status.toUpperCase(), visible: true },
    { k: "TX COUNT",       v: `${totalVisible} signals`, visible: "partial" as const },
    { k: "INDIVIDUAL AMT", v: "???",               visible: false },
    { k: "WHO PAID WHAT",  v: "???",               visible: false },
    { k: "REAL VS NOISE",  v: `indeterminate (${noiseCount} could be noise)`, visible: false },
    { k: "TOTAL LOCKED",
      v: vault.status === "paid" ? `${vault.totalLocked} USDC` : "???",
      visible: vault.status === "paid" },
  ];

  return (
    <div style={{ border: "1px solid #2a1a00", borderRadius: 8, padding: 18, background: "#080600" }}>
      <div style={{ fontSize: 9, color: "#6a4000", letterSpacing: 3, marginBottom: 12 }}>
        OBSERVER / PUBLIC CHAIN STATE
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        {rows.map(({ k, v, visible }) => (
          <div key={k} style={{
            background: visible === true ? "#0e0900" : visible === "partial" ? "#0c0c00" : "#0e0700",
            border: `1px solid ${visible === true ? "#3a2500" : visible === "partial" ? "#2a2a00" : "#2a1200"}`,
            borderRadius: 4, padding: "7px 10px",
          }}>
            <div style={{ fontSize: 9, fontFamily: "monospace", letterSpacing: 1, marginBottom: 3,
              color: visible === true ? "#6a4a00" : "#2a2a00" }}>
              {k}
            </div>
            <div style={{ fontSize: 12, fontFamily: "monospace",
              color: visible === true ? "#ccaa44" : visible === "partial" ? "#555500" : "#331a1a" }}>
              {String(v)}
            </div>
          </div>
        ))}
      </div>
      <div style={{
        background: "#060500", border: "1px solid #1a1500", borderRadius: 4,
        padding: "8px 10px", fontFamily: "monospace", fontSize: 10, color: "#4a4000", lineHeight: 1.6,
      }}>
        <span style={{ color: "#6a5500" }}>timing_variance:</span>{" "}
        {totalVisible > 2 ? "HIGH → timing attack infeasible" : "collecting data..."}
        {" · "}
        <span style={{ color: "#6a5500" }}>attack_feasible:</span>{" "}
        <span style={{ color: "#ff4444" }}>false</span>
      </div>

      {/* ← ATTACK SIMULATOR */}
      <AttackSimulator commits={commits} />
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [vaultId] = useState("bv-" + Math.random().toString(36).slice(2, 8));

  const [vault, setVault] = useState<Vault>({
    id: vaultId,
    condition: "Freelance delivery approved",
    deadline: Date.now() + 10 * 60 * 1000,
    status: "open",
    totalLocked: 0,
    commits: [],
  });

  const [wallets, setWallets] = useState<WalletState[]>([
    { id: "payer_a", label: "Alice", amount: 120, committed: false, salt: randomSalt(), commitment: "" },
    { id: "payer_b", label: "Bob",   amount: 85,  committed: false, salt: randomSalt(), commitment: "" },
    { id: "payer_c", label: "Carol", amount: 45,  committed: false, salt: randomSalt(), commitment: "" },
  ]);

  const [revealPhase, setRevealPhase] = useState<RevealPhase>("sealed");
  const [log, setLog] = useState<string[]>(["[system] Blind Vault ready. PER session standby."]);
  const [timeLeft, setTimeLeft] = useState("");
  const [settling, setSettling] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [log]);

  useEffect(() => {
    const tick = setInterval(() => {
      const diff = vault.deadline - Date.now();
      if (diff <= 0) {
        setTimeLeft("EXPIRED");
        setVault((v) => v.status === "open" ? { ...v, status: "refunded" } : v);
      } else {
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${m}:${s.toString().padStart(2, "0")}`);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [vault.deadline, vault.status]);

  function addLog(msg: string) {
    const ts = new Date().toLocaleTimeString();
    setLog((l) => [...l.slice(-30), `[${ts}] ${msg}`]);
  }

  async function handleCommit(walletId: WalletId, amount: number) {
    if (vault.status !== "open") return;
    const wallet = wallets.find((w) => w.id === walletId)!;
    addLog(`PER session opened — ${wallet.label} committing...`);
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 400));

    const commitment = await sha256(`${amount}:${wallet.salt}:${vaultId}`);
    const realCommit: Commit = { walletId, commitment, timestamp: Date.now(), isNoise: false };

    const noiseCount = Math.floor(Math.random() * 3) + 1;
    const noiseCommits: Commit[] = Array.from({ length: noiseCount }, (_, i) => ({
      walletId: `noise_${i}`,
      commitment: Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      timestamp: Date.now() + Math.floor(Math.random() * 2500) + 300,
      isNoise: true,
    }));

    addLog(`Noise injected: ${noiseCount} dummy tx (observer cannot distinguish)`);
    const allNew = [realCommit, ...noiseCommits].sort((a, b) => a.timestamp - b.timestamp);
    setVault((v) => ({ ...v, commits: [...v.commits, ...allNew] }));
    setWallets((ws) => ws.map((w) => w.id === walletId ? { ...w, committed: true, amount, commitment } : w));
    addLog(`${wallet.label}: sealed. Amount [${amount} USDC] stays in PER forever.`);
  }

  async function handleSettle() {
    if (settling) return;
    setSettling(true);
    addLog("Condition approved — triggering reveal + auto-settle...");
    setVault((v) => ({ ...v, status: "settling" }));

    // Brief pause before reveal
    await new Promise((r) => setTimeout(r, 300));

    // ← THE REVEAL MOMENT: tirai terbuka 1.5 detik
    addLog("PER reveal phase — ephemeral state briefly exposed...");
    setRevealPhase("revealing");
    await new Promise((r) => setTimeout(r, 1500));
    setRevealPhase("done");

    // Settle
    const total = wallets.filter((w) => w.committed).reduce((s, w) => s + w.amount, 0);
    setVault((v) => ({ ...v, status: "paid", totalLocked: total }));
    addLog(`Auto-settled: ${total} USDC paid out. Zero admin. Zero trust.`);
    addLog("PER session closed — ephemeral state destroyed.");
  }

  const allCommitted = wallets.every((w) => w.committed);
  const committedCount = wallets.filter((w) => w.committed).length;

  return (
    <>
      <Scanline />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #020902; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { opacity: 1; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1a3a1a; border-radius: 2px; }
      `}</style>

      <div style={{
        minHeight: "100vh", background: "#020902", color: "#88cc88",
        fontFamily: "'Courier New', monospace", padding: "24px 20px",
        maxWidth: 920, margin: "0 auto",
      }}>

        {/* Header */}
        <div style={{ marginBottom: 24, borderBottom: "1px solid #0a1a0a", paddingBottom: 18 }}>
          <div style={{ fontSize: 9, color: "#1a4a1a", letterSpacing: 4, marginBottom: 6 }}>
            MAGICBLOCK · PRIVATE EPHEMERAL ROLLUPS · SOLANA DEVNET
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 34, fontWeight: 700, color: "#00ff88", letterSpacing: -1, fontFamily: "monospace" }}>
              BLIND VAULT
            </h1>
            <StatusPill status={vault.status} />
            <span style={{ marginLeft: "auto", fontSize: 11, color: "#2a5a2a" }}>{vault.id}</span>
          </div>
          <div style={{ fontSize: 12, color: "#2a5a2a", marginTop: 4 }}>
            Privacy escrow primitive — amounts sealed in PER, never touch Solana L1
          </div>
        </div>

        {/* Meta */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { k: "CONDITION", v: vault.condition },
            { k: "DEADLINE",  v: timeLeft || "..." },
            { k: "COMMITTED", v: `${committedCount} / 3 wallets` },
          ].map(({ k, v }) => (
            <div key={k} style={{
              background: "#040c04", border: "1px solid #0a1a0a",
              borderRadius: 6, padding: "10px 14px",
            }}>
              <div style={{ fontSize: 9, color: "#1a4a1a", letterSpacing: 2, marginBottom: 3 }}>{k}</div>
              <div style={{ fontSize: 13, color: "#77bb77" }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>

          {/* Left: wallets */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 9, color: "#1a4a1a", letterSpacing: 3, marginBottom: 2 }}>PAYER WALLETS</div>

            {wallets.map((w) => (
              <WalletCard
                key={w.id}
                wallet={w}
                onCommit={handleCommit}
                disabled={vault.status !== "open"}
                revealPhase={revealPhase}
              />
            ))}

            {allCommitted && vault.status === "open" && (
              <button
                onClick={handleSettle}
                style={{
                  marginTop: 4, width: "100%", background: "#001a08",
                  border: "1px solid #00ff8877", borderRadius: 6,
                  color: "#00ff88", fontFamily: "monospace",
                  fontSize: 13, letterSpacing: 2, padding: "13px 0", cursor: "pointer",
                }}
              >
                APPROVE CONDITION + SETTLE
              </button>
            )}

            {vault.status === "settling" && (
              <div style={{
                marginTop: 4, background: "#0e0e00", border: "1px solid #ffcc0044",
                borderRadius: 6, padding: 14, textAlign: "center",
                color: revealPhase === "revealing" ? "#ffcc00" : "#888800",
                fontSize: 12, letterSpacing: 2,
                transition: "color 0.3s",
              }}>
                {revealPhase === "revealing" ? "EPHEMERAL STATE REVEALING..." : "SETTLING..."}
              </div>
            )}

            {vault.status === "paid" && (
              <div style={{
                marginTop: 4, background: "#001a10", border: "1px solid #00ccff44",
                borderRadius: 6, padding: 14, textAlign: "center",
                color: "#00ccff", fontSize: 13, letterSpacing: 1,
              }}>
                {vault.totalLocked} USDC paid out · trustless · zero admin
              </div>
            )}

            {vault.status === "refunded" && (
              <div style={{
                marginTop: 4, background: "#1a0800", border: "1px solid #ff664444",
                borderRadius: 6, padding: 14, textAlign: "center", color: "#ff6644", fontSize: 13,
              }}>
                deadline passed · all funds refunded
              </div>
            )}
          </div>

          {/* Right: observer + log */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, color: "#5a3a00", letterSpacing: 3, marginBottom: 8 }}>
                OBSERVER / CHAIN ANALYSIS
              </div>
              <ObserverPanel vault={vault} commits={vault.commits} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: "#1a4a1a", letterSpacing: 3, marginBottom: 6 }}>
                PER SESSION LOG
              </div>
              <CommitLog commits={vault.commits} />
            </div>
          </div>
        </div>

        {/* Activity log */}
        <div style={{
          background: "#030903", border: "1px solid #090f09", borderRadius: 6,
          padding: "10px 12px", fontFamily: "monospace", fontSize: 11,
          maxHeight: 96, overflowY: "auto", lineHeight: 1.7,
        }}>
          {log.map((l, i) => (
            <div key={i} style={{ color: i === log.length - 1 ? "#55aa55" : "#2a5a2a" }}>{l}</div>
          ))}
          <div ref={logEndRef} />
        </div>

        <div style={{ marginTop: 14, fontSize: 9, color: "#0f2a0f", letterSpacing: 2, textAlign: "center" }}>
          BLIND VAULT · MAGICBLOCK PERs · AMOUNTS ARE EPHEMERAL · PRIVACY BY ARCHITECTURE
        </div>
      </div>
    </>
  );
}
