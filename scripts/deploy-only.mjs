import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, ".."); 
const BACKEND_ENV_PATH = path.join(PROJECT_ROOT, "backend", ".env");

const ARTIFACTS = {
  LuxuryCoin: path.join(PROJECT_ROOT, "artifacts", "contracts", "LuxuryCoin.sol", "LuxuryCoin.json"),
  WatchNFT: path.join(PROJECT_ROOT, "artifacts", "contracts", "WatchNFT.sol", "WatchNFT.json"),
  WatchMarket: path.join(PROJECT_ROOT, "artifacts", "contracts", "WatchMarket.sol", "WatchMarket.json"),
};

function die(msg) {
  console.error(`❌ FATAL: ${msg}`);
  process.exit(1);
}

function isHexAddress(s) {
  return typeof s === "string" && /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

function readEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};
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

async function getFireFlyAccounts(base) {
  try {
    const verifiers = await ffGet(`${base}/verifiers`);
    return verifiers.filter(v => v.type === "ethereum_address").map(v => v.value).reverse(); 
  } catch (e) {
    return [];
  }
}

async function waitOperation(base, opId) {
  const start = Date.now();
  while (true) {
    if (Date.now() - start > 300000) throw new Error(`Timeout operazione ${opId}`);
    const op = await ffGet(`${base}/operations/${opId}`);
    const status = String(op?.status || "").toLowerCase();
    if (status === "succeeded") return op;
    if (status === "failed") throw new Error(`Operazione fallita: ${JSON.stringify(op)}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

async function deployContract({ base, fromKey, name, artifactPath, inputArgs }) {
  const { abi, bytecode } = loadArtifact(artifactPath);
  console.log(`🚀 Deploying ${name}...`);

  const resp = await ffPost(`${base}/contracts/deploy`, {
    contract: bytecode, 
    definition: abi,
    input: inputArgs || [],
    key: fromKey,
  });

  const op = await waitOperation(base, resp.id);
  const addr = op?.receipt?.contractAddress || op?.output?.contractAddress || 
               op?.receipt?.contractLocation?.address || op?.output?.contractLocation?.address;

  if (!isHexAddress(addr)) throw new Error(`[${name}] Deploy riuscito ma indirizzo non trovato`);
  
  console.log(`✅ ${name} all'indirizzo: ${addr}`);
  return addr;
}

async function main() {
  const env = readEnvFile(BACKEND_ENV_PATH);
  const base = env.FF_PRODUCER_BASE;
  if (!base) die("FF_PRODUCER_BASE mancante in backend/.env");

  const accounts = await getFireFlyAccounts(base);
  const producerAddr = accounts[0] || env.PRODUCER_ADDR;

  console.log("=== 🛠️  START DEPLOY ONLY ===");
  console.log(`Utilizzando account: ${producerAddr}\n`);

  // 1. LuxuryCoin
  const luxAddr = await deployContract({
    base, fromKey: producerAddr, name: "LuxuryCoin", artifactPath: ARTIFACTS.LuxuryCoin,
    inputArgs: [accounts[1] || producerAddr, accounts[2] || producerAddr]
  });

  // 2. WatchNFT
  const nftAddr = await deployContract({
    base, fromKey: producerAddr, name: "WatchNFT", artifactPath: ARTIFACTS.WatchNFT,
    inputArgs: [producerAddr],
  });

  // 3. WatchMarket
  const marketAddr = await deployContract({
    base, fromKey: producerAddr, name: "WatchMarket", artifactPath: ARTIFACTS.WatchMarket,
    inputArgs: [luxAddr, nftAddr],
  });

  console.log("\n=== 📝 AGGIORNAMENTO .ENV ===");
  upsertEnvVars(BACKEND_ENV_PATH, {
    LUXURYCOIN_ADDRESS: luxAddr,
    WATCHNFT_ADDRESS: nftAddr,
    WATCHMARKET_ADDRESS: marketAddr,
  });

  console.log("✅ File .env aggiornato con i nuovi indirizzi.");
  console.log("Sincronizzazione completata.");
}

main().catch(e => die(e.message));