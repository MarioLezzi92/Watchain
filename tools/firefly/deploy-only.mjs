// tools/firefly/deploy-only.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root progetto = ../../ (tools/firefly -> tools -> root)
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const BACKEND_ENV_PATH = path.join(PROJECT_ROOT, "backend", ".env");

// Percorsi artifact hardhat
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
  const abi = j.abi || j.definition;
  const bytecode = j.bytecode || (j.data && j.data.bytecode) || "";
  if (!Array.isArray(abi) || abi.length === 0) die(`ABI mancante in: ${p}`);
  if (!bytecode.startsWith("0x")) die(`Bytecode non valido in: ${p}`);
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
  const addr =
    op?.receipt?.contractAddress ||
    op?.output?.contractAddress ||
    op?.receipt?.contractLocation?.address ||
    op?.output?.contractLocation?.address;

  if (!isHexAddress(addr)) {
    throw new Error(`[${name}] deploy succeeded ma address non trovato`);
  }

  return addr;
}

async function main() {
  const env = readEnvFile(BACKEND_ENV_PATH);

  const base = env.FF_PRODUCER_BASE;
  const producerAddr = env.PRODUCER_ADDR;
  const watchNftFactory = env.WATCHNFT_FACTORY || producerAddr;

  if (!base) die("FF_PRODUCER_BASE mancante");
  if (!isHexAddress(producerAddr)) die("PRODUCER_ADDR non valido");
  if (!isHexAddress(watchNftFactory)) die("WATCHNFT_FACTORY non valido");

  const luxuryAddr = await deployContract({
    base,
    fromKey: producerAddr,
    name: "LuxuryCoin",
    artifactPath: ARTIFACTS.LuxuryCoin,
  });

  const watchNftAddr = await deployContract({
    base,
    fromKey: producerAddr,
    name: "WatchNFT",
    artifactPath: ARTIFACTS.WatchNFT,
    inputArgs: [watchNftFactory],
  });

  const watchMarketAddr = await deployContract({
    base,
    fromKey: producerAddr,
    name: "WatchMarket",
    artifactPath: ARTIFACTS.WatchMarket,
    inputArgs: [luxuryAddr, watchNftAddr],
  });

  console.log("\n=== CONTRACT ADDRESSES ===");
  console.log(`LUXURYCOIN_ADDRESS=${luxuryAddr}`);
  console.log(`WATCHNFT_ADDRESS=${watchNftAddr}`);
  console.log(`WATCHMARKET_ADDRESS=${watchMarketAddr}`);
  console.log("=========================\n");

  upsertEnvVars(BACKEND_ENV_PATH, {
    LUXURYCOIN_ADDRESS: luxuryAddr,
    WATCHNFT_ADDRESS: watchNftAddr,
    WATCHMARKET_ADDRESS: watchMarketAddr,
  });

  console.log("backend/.env aggiornato automaticamente ✔");
}

main().catch((e) => {
  console.error("\nFATAL:", e.message || e);
  process.exit(1);
});
