import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "../off-chain/env.js"; 

// Configurazione dinamica: Punta al nodo Producer che ha i diritti di deploy
const FF_BASE = env.FF_PRODUCER_BASE;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, ".."); 

// Mapping degli Artifacts di compilazione (generati da Hardhat)
const ARTIFACTS = {
  LuxuryCoin: path.join(PROJECT_ROOT, "artifacts", "contracts", "LuxuryCoin.sol", "LuxuryCoin.json"),
  WatchNFT: path.join(PROJECT_ROOT, "artifacts", "contracts", "WatchNFT.sol", "WatchNFT.json"),
  WatchMarket: path.join(PROJECT_ROOT, "artifacts", "contracts", "WatchMarket.sol", "WatchMarket.json"),
};

// Utilities per robustezza script
function die(msg) { console.error(`FATAL: ${msg}`); process.exit(1); }
function isHexAddress(s) { return typeof s === "string" && /^0x[a-fA-F0-9]{40}$/.test(s.trim()); }

/**
 * Caricamento Artifacts.
 * Legge il bytecode e l'ABI necessari per istruire FireFly sul deployment.
 */
function loadArtifact(p) {
  if (!fs.existsSync(p)) die(`Artifact non trovato in: ${p}`);
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  
  // Normalizzazione Bytecode (gestisce formati diversi di output solc/hardhat)
  let bytecode = j.bytecode || (j.data && j.data.bytecode) || "";
  if (typeof bytecode === 'object') bytecode = bytecode.object;
  
  const abi = j.abi || j.definition;
  if (!bytecode.startsWith("0x")) bytecode = "0x" + bytecode;
  
  return { abi, bytecode };
}

/**
 * Wrapper HTTP per FireFly API.
 * Astrazione per semplificare le chiamate REST verso il nodo.
 */
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

/**
 * Polling delle Operazioni Asincrone.
 * FireFly accoda le transazioni. Questa funzione aspetta che la blockchain
 * confermi il blocco ("Succeeded") prima di procedere.
 * Pattern: Async/Await Polling.
 */
async function waitOperation(opId) {
  const start = Date.now();
  // Timeout di sicurezza: 60 secondi
  while (Date.now() - start < 60000) { 
    const op = await ffReq("GET", `/operations/${opId}`);
    if (op.status === "Succeeded") return op;
    if (op.status === "Failed") throw new Error(op.error || "Operazione fallita su FireFly");
    
    // Backoff: aspetta 1 secondo prima di riprovare
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error("Timeout: Il deploy sta impiegando troppo tempo (rete congestionata?).");
}

/**
 * Funzione Core di Deployment.
 * Invia il bytecode grezzo tramite FireFly che lo firma e lo trasmette alla chain.
 */
async function deployContract(name, artifactKey, args, fromKey) {
  const { abi, bytecode } = loadArtifact(ARTIFACTS[artifactKey]);
  console.log(`📦 Deploying ${name}...`);
  
  // 1. Invio richiesta deploy
  const res = await ffReq("POST", "/contracts/deploy", {
    contract: bytecode, 
    definition: abi, 
    input: args || [], // Costruttore args
    key: fromKey       // Chi paga il gas (Producer)
  });

  // 2. Attesa mining
  const op = await waitOperation(res.id);
  const addr = op.output.contractLocation.address;
  
  if (!isHexAddress(addr)) throw new Error("Indirizzo ricevuto non valido");
  
  console.log(`✅ ${name} distribuito a: ${addr}`);
  return addr;
}

/**
 * Orchestratore Principale.
 * Definisce la sequenza logica di deployment:
 * 1. Identità -> 2. Token ERC20 -> 3. NFT ERC721 -> 4. Marketplace
 */
async function main() {
  console.log("🚀 Avvio processo di deployment su rete Geth (via FireFly)...");

  // STEP 1: Resolution degli Attori
  // Recuperiamo le identità Ethereum configurate nel nodo per assegnare i ruoli iniziali.
  const verifiers = await ffReq("GET", "/verifiers?type=ethereum_address&limit=3");
  // Nota: FireFly restituisce in ordine cronologico inverso di creazione, quindi invertiamo.
  const accounts = verifiers.map(v => v.value).reverse(); 
  
  if (accounts.length < 3) die("Errore configurazione: servono almeno 3 account (Producer, Reseller, Consumer).");

  const [producer, reseller, consumer] = accounts;
  console.log(`Account Producer (Deployer): ${producer}`);

  // STEP 2: Dependency Injection & Deployment
  
  // A. LuxuryCoin (ERC-20)
  // Distribuisce token iniziali a Reseller e Consumer per i test.
  const coinAddr = await deployContract("LuxuryCoin", "LuxuryCoin", [reseller, consumer], producer);
  
  // B. WatchNFT (ERC-721)
  // Il Producer è l'unico admin autorizzato a mintare.
  const nftAddr = await deployContract("WatchNFT", "WatchNFT", [producer], producer);
  
  // C. WatchMarket (Marketplace)
  // Il mercato deve conoscere gli indirizzi dei token che scambia (Coin e NFT).
  const marketAddr = await deployContract("WatchMarket", "WatchMarket", [coinAddr, nftAddr], producer);

  console.log("\n--- RECAP DEPLOYMENT (Copia questi indirizzi se necessario) ---");
  console.log(`LuxuryCoin (Payment):  ${coinAddr}`);
  console.log(`WatchNFT (Asset):      ${nftAddr}`);
  console.log(`WatchMarket (Logic):   ${marketAddr}`);
  console.log("------------------------\n");
}

main().catch(e => die(e.message));