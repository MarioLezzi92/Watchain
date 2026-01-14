// tools/firefly/deploy-only.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const BACKEND_ENV_PATH = path.join(PROJECT_ROOT, "backend", ".env");

const ARTIFACTS = {
  LuxuryCoin: path.join(PROJECT_ROOT, "artifacts", "contracts", "LuxuryCoin.sol", "LuxuryCoin.json"),
  WatchNFT: path.join(PROJECT_ROOT, "artifacts", "contracts", "WatchNFT.sol", "WatchNFT.json"),
  WatchMarket: path.join(PROJECT_ROOT, "artifacts", "contracts", "WatchMarket.sol", "WatchMarket.json"),
};

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function isHexAddress(s) {
  return typeof s === "string" && /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

function readEnvFile(envPath) {
  if (!fs.existsSync(envPath)) die(`ENV non trovato: ${envPath}`);
  const txt = fs.readFileSync(envPath, "utf8");
  const out = {};
  for (const line of txt.split(/\r?\n/)) {
    const l = line.trim();
    if (!l || l.startsWith("#")) continue;
    const idx = l.indexOf("=");
    if (idx === -1) continue;
    const k = l.slice(0, idx).trim();
    const v = l.slice(idx + 1).trim();
    out[k] = v;
  }
  return out;
}

function upsertEnvVars(envPath, newVars) {
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const lines = content.split(/\r?\n/);
  const found = new Set();

  const updated = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const idx = trimmed.indexOf("=");
    if (idx === -1) return line;
    const key = trimmed.slice(0, idx);
    if (key in newVars) {
      found.add(key);
      return `${key}=${newVars[key]}`;
    }
    return line;
  });

  for (const [k, v] of Object.entries(newVars)) {
    if (!found.has(k)) updated.push(`${k}=${v}`);
  }
  fs.writeFileSync(envPath, updated.join("\n"), "utf8");
}

function loadArtifact(p) {
  if (!fs.existsSync(p)) die(`Artifact non trovato: ${p}`);
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  
  let bytecode = j.bytecode || (j.data && j.data.bytecode) || "";
  if (typeof bytecode === 'object') bytecode = bytecode.object;
  
  const abi = j.abi || j.definition;
  
  if (!bytecode.startsWith("0x")) bytecode = "0x" + bytecode;
  if (!Array.isArray(abi) || abi.length === 0) die(`ABI mancante in: ${p}`);
  
  return { abi, bytecode };
}

async function ffPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  const json = txt ? JSON.parse(txt) : {};
  if (!res.ok) throw new Error(json?.error || txt);
  return json;
}

async function ffGet(url) {
  const res = await fetch(url);
  const txt = await res.text();
  const json = txt ? JSON.parse(txt) : {};
  if (!res.ok) throw new Error(json?.error || txt);
  return json;
}

// Recupera gli account dallo stack FireFly attivo
async function getFireFlyAccounts(base) {
  try {
    // Chiediamo i verifier (identità on-chain)
    const verifiers = await ffGet(`${base}/verifiers`);
    
    // Filtriamo per prendere solo gli indirizzi ethereum
    const accounts = verifiers
      .filter(v => v.type === "ethereum_address")
      .map(v => v.value);

    // FIX: L'API spesso restituisce gli account in ordine inverso (LIFO).
    // Li giriamo per avere [Org0, Org1, Org2] come nella CLI.
    return accounts.reverse(); 
  } catch (e) {
    console.warn("⚠️  Impossibile recuperare account da FireFly:", e.message);
    return [];
  }
}

async function waitOperation(base, opId, timeoutMs = 300000) {
  const start = Date.now();
  while (true) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timeout waiting operation ${opId}`);
    const op = await ffGet(`${base}/operations/${opId}`);
    const status = String(op?.status || "").toLowerCase();
    if (status === "succeeded") return op;
    if (status === "failed") throw new Error(`Operation failed: ${JSON.stringify(op)}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

async function deployContract({ base, fromKey, name, artifactPath, inputArgs }) {
  const { abi, bytecode } = loadArtifact(artifactPath);

  const resp = await ffPost(`${base}/contracts/deploy?publish=true`, {
    contract: bytecode, 
    definition: abi,
    input: inputArgs || [],
    key: fromKey,
  });

  const opId = resp?.id;
  if (!opId) throw new Error(`[${name}] operation id non trovato`);

  const op = await waitOperation(base, opId);
  const addr = op?.receipt?.contractAddress || op?.output?.contractAddress || 
               op?.receipt?.contractLocation?.address || op?.output?.contractLocation?.address;

  if (!isHexAddress(addr)) throw new Error(`[${name}] deploy succeeded ma address non trovato`);
  
  console.log(`✅ ${name} -> ${addr}`);
  return addr;
}

async function main() {
  const env = readEnvFile(BACKEND_ENV_PATH);
  const base = env.FF_PRODUCER_BASE;
  
  if (!base) die("FF_PRODUCER_BASE mancante nel file .env");

  console.log(`🔌 Connesso a FireFly su: ${base}`);
  
  // --- AUTO-CONFIGURAZIONE UTENTI ---
  const accounts = await getFireFlyAccounts(base);
  
  let producerAddr, resellerAddr, consumerAddr;

  if (accounts.length > 0) {
    console.log(`🔎 Trovati ${accounts.length} account nello stack.`);
    // Assegnazione smart:
    // Se c'è solo 1 account -> tutti ruoli a lui
    // Se ce ne sono 2 -> Producer(0), Reseller(1), Consumer(0)
    // Se ce ne sono 3+ -> Producer(0), Reseller(1), Consumer(2)
    producerAddr = accounts[0];
    resellerAddr = accounts[1] || accounts[0];
    consumerAddr = accounts[2] || accounts[0];
  } else {
    // Fallback al vecchio metodo (lettura da env) se l'API fallisce
    console.warn("⚠️  Nessun account rilevato via API, uso .env...");
    producerAddr = env.PRODUCER_ADDR;
    resellerAddr = env.RESELLER_ADDR || "0x0000000000000000000000000000000000000000";
    consumerAddr = env.CONSUMER_ADDR || "0x0000000000000000000000000000000000000000";
  }

  if (!isHexAddress(producerAddr)) die("ERRORE: Impossibile trovare un PRODUCER_ADDR valido.");

  console.log("\n=== 👥 UTENTI RILEVATI ===");
  console.log(`PRODUCER (Deployer): ${producerAddr}`);
  console.log(`RESELLER           : ${resellerAddr}`);
  console.log(`CONSUMER           : ${consumerAddr}`);

  // Aggiorniamo subito il .env con gli utenti corretti
  upsertEnvVars(BACKEND_ENV_PATH, {
    PRODUCER_ADDR: producerAddr,
    RESELLER_ADDR: resellerAddr,
    CONSUMER_ADDR: consumerAddr
  });
  console.log("📝 backend/.env aggiornato con i nuovi utenti.\n");

  // --- DEPLOY CONTRACTS ---

  // Deploy LUXURYCOIN (passando reseller e consumer corretti)
  const luxuryAddr = await deployContract({
    base,
    fromKey: producerAddr,
    name: "LuxuryCoin",
    artifactPath: ARTIFACTS.LuxuryCoin,
    inputArgs: [resellerAddr, consumerAddr]
  });

  const watchNftAddr = await deployContract({
    base,
    fromKey: producerAddr,
    name: "WatchNFT",
    artifactPath: ARTIFACTS.WatchNFT,
    inputArgs: [producerAddr],
  });

  const watchMarketAddr = await deployContract({
    base,
    fromKey: producerAddr,
    name: "WatchMarket",
    artifactPath: ARTIFACTS.WatchMarket,
    inputArgs: [luxuryAddr, watchNftAddr],
  });

  console.log("\n=== 📜 CONTRACT ADDRESSES ===");
  console.log(`LUXURYCOIN_ADDRESS=${luxuryAddr}`);
  console.log(`WATCHNFT_ADDRESS=${watchNftAddr}`);
  console.log(`WATCHMARKET_ADDRESS=${watchMarketAddr}`);

  // Aggiorniamo il .env con gli indirizzi dei contratti
  upsertEnvVars(BACKEND_ENV_PATH, {
    LUXURYCOIN_ADDRESS: luxuryAddr,
    WATCHNFT_ADDRESS: watchNftAddr,
    WATCHMARKET_ADDRESS: watchMarketAddr,
  });

  console.log("\n✅ backend/.env aggiornato con i contratti completi!");
}

main().catch((e) => {
  console.error("\nFATAL ERROR:", e.message || e);
  process.exit(1);
});