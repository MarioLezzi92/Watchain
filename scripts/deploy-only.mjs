import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "../off-chain/env.js"; 

// Configurazione dinamica dal file env
const FF_BASE = env.FF_PRODUCER_BASE;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, ".."); 

// Percorsi degli artifacts generati da Hardhat/Truffle
const ARTIFACTS = {
  LuxuryCoin: path.join(PROJECT_ROOT, "artifacts", "contracts", "LuxuryCoin.sol", "LuxuryCoin.json"),
  WatchNFT: path.join(PROJECT_ROOT, "artifacts", "contracts", "WatchNFT.sol", "WatchNFT.json"),
  WatchMarket: path.join(PROJECT_ROOT, "artifacts", "contracts", "WatchMarket.sol", "WatchMarket.json"),
};

function die(msg) { console.error(`FATAL: ${msg}`); process.exit(1); }
function isHexAddress(s) { return typeof s === "string" && /^0x[a-fA-F0-9]{40}$/.test(s.trim()); }

function loadArtifact(p) {
  if (!fs.existsSync(p)) die(`Artifact non trovato in: ${p}`);
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  let bytecode = j.bytecode || (j.data && j.data.bytecode) || "";
  if (typeof bytecode === 'object') bytecode = bytecode.object;
  const abi = j.abi || j.definition;
  if (!bytecode.startsWith("0x")) bytecode = "0x" + bytecode;
  return { abi, bytecode };
}

async function ffReq(method, endpoint, body) {
  const res = await fetch(`${FF_BASE}${endpoint}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  const json = txt ? JSON.parse(txt) : {};
  if (!res.ok) throw new Error(json?.error || txt);
  return json;
}

async function waitOperation(opId) {
  const start = Date.now();
  while (Date.now() - start < 60000) { 
    const op = await ffReq("GET", `/operations/${opId}`);
    if (op.status === "Succeeded") return op;
    if (op.status === "Failed") throw new Error(op.error || "Operazione fallita su FireFly");
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error("Timeout: Il deploy sta impiegando troppo tempo.");
}

async function deployContract(name, artifactKey, args, fromKey) {
  const { abi, bytecode } = loadArtifact(ARTIFACTS[artifactKey]);
  console.log(`📦 Deploying ${name}...`);
  
  const res = await ffReq("POST", "/contracts/deploy", {
    contract: bytecode, definition: abi, input: args || [], key: fromKey
  });
  const op = await waitOperation(res.id);
  const addr = op.output.contractLocation.address;
  
  if (!isHexAddress(addr)) throw new Error("Indirizzo ricevuto non valido");
  
  console.log(`✅ ${name} distribuito a: ${addr}`);
  return addr;
}

async function main() {
  console.log("🚀 Avvio processo di deployment su rete Geth...");

  // 1. Recupero degli account configurati in FireFly
  const verifiers = await ffReq("GET", "/verifiers?type=ethereum_address&limit=3");
  const accounts = verifiers.map(v => v.value).reverse(); 
  if (accounts.length < 3) die("Errore: FireFly deve avere almeno 3 account configurati (Producer, Reseller, Consumer).");

  const [producer, reseller, consumer] = accounts;
  console.log(`Account Producer: ${producer}`);

  // 2. Deploy della sequenza di contratti
  const coinAddr = await deployContract("LuxuryCoin", "LuxuryCoin", [reseller, consumer], producer);
  const nftAddr = await deployContract("WatchNFT", "WatchNFT", [producer], producer);
  const marketAddr = await deployContract("WatchMarket", "WatchMarket", [coinAddr, nftAddr], producer);

  console.log("\n--- RECAP DEPLOYMENT ---");
  console.log(`LuxuryCoin (ERC20):  ${coinAddr}`);
  console.log(`WatchNFT (ERC721):   ${nftAddr}`);
  console.log(`WatchMarket:         ${marketAddr}`);
  console.log("------------------------\n");
}

main().catch(e => die(e.message));