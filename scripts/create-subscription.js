import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// --- CONFIGURAZIONE DEBUG PATH ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 1. CERCA IL FILE .ENV ---
// Cerca in cartelle diverse per robustezza (backend, root, parent)
function findEnv() {
  const paths = [
    path.join(__dirname, "backend", ".env"),
    path.join(__dirname, ".env"),
    path.resolve(__dirname, "..", "backend", ".env")
  ];

  for (const p of paths) {
    if (fs.existsSync(p)) {
      console.log(`✅ File .env trovato in: ${p}`);
      return p;
    }
  }
  return null;
}

const ENV_PATH = findEnv();

if (!ENV_PATH) {
  console.error("❌ ERRORE: File .env NON TROVATO. Esegui prima il deploy!");
  process.exit(1);
}

// --- 2. LEGGI LE VARIABILI ---
const envContent = fs.readFileSync(ENV_PATH, "utf8");
function getVal(key) {
  const match = envContent.match(new RegExp(`^${key}=(.*)(\r)?$`, "m"));
  return match ? match[1].trim() : null;
}

const SECRET = getVal("WEBHOOK_SECRET"); 
const MARKET_ADDR = getVal("WATCHMARKET_ADDRESS");
const NFT_ADDR = getVal("WATCHNFT_ADDRESS");

// --- 3. DEFINIZIONE EVENTI (FIX APPLICATO) ---
// Questi sono i nomi esatti degli eventi nei tuoi Smart Contract
const events = [
  "Manufactured",  // WatchNFT.sol
  "Certified",     // WatchNFT.sol
  "Listed",        // WatchMarket.sol
  "Purchased",     // WatchMarket.sol
  "Canceled"       // WatchMarket.sol
];

// --- 4. CONFIGURAZIONE RETE ---
// URL del nodo FireFly (Producer)
const FF_URL = "http://127.0.0.1:5000/api/v1/namespaces/default";
// URL del tuo Backend (visto da dentro il container Docker di FireFly)
const BACKEND_URL = "http://host.docker.internal:3001/api/events/webhook"; 

// --- CHECK VARIABILI ---
console.log("\n--- VERIFICA CONFIGURAZIONE ---");
console.log(`SECRET: ${SECRET ? "OK" : "VUOTO ❌"}`);
console.log(`MARKET: ${MARKET_ADDR || "VUOTO ❌"}`);
console.log(`NFT:    ${NFT_ADDR || "VUOTO ❌"}`);

if (!SECRET || !MARKET_ADDR || !NFT_ADDR) {
  console.error("❌ ERRORE: Variabili mancanti nel .env. Hai fatto il deploy?");
  process.exit(1);
}

// --- HELPER HTTP ---
async function ffRequest(method, endpoint, body = null) {
  try {
    const res = await fetch(`${FF_URL}/${endpoint}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    // Ignora errori se stiamo cancellando cose che non esistono
    if (res.status === 404 && method === "DELETE") return { status: "NOT_FOUND" };
    
    if (!res.ok) {
        const txt = await res.text();
        return { status: "ERROR", msg: txt };
    }
    return { status: "OK" };
  } catch (e) {
    return { status: "NETWORK_ERROR", msg: e.message };
  }
}

// --- MAIN ---
async function main() {
  console.log("\n🚀 AVVIO SCRIPT SUBSCRIPTION...");

  // A. Crea la Subscription (Canale Webhook)
  // Questo dice a Firefly: "Quando ricevi un evento con topic 'app-events', mandalo al mio backend"
  const subRes = await ffRequest("POST", "subscriptions", {
    name: "watchchain_webhook",
    transport: "webhooks",
    filter: { 
        events: "blockchain_event_received", 
        topic: "app-events" // Filtra solo gli eventi taggati con questo topic
    },
    options: {
      url: BACKEND_URL,
      method: "POST",
      headers: { "x-watchchain-secret": SECRET },
      withData: true
    }
  });

  if (subRes.status === "ERROR") {
      // Se esiste già non è un problema grave, ma lo segnaliamo
      if (subRes.msg.includes("409")) {
        console.log("ℹ️  Subscription già esistente.");
      } else {
        console.error(`❌ ERRORE CREAZIONE SUB: ${subRes.msg}`);
        return;
      }
  } else {
      console.log(`✅ Subscription Creata/Aggiornata.`);
  }

  // B. Crea i Listener (Ascoltatori su Blockchain)
  console.log("🎧 Configurazione Listeners...");
  
  for (const evt of events) {
    // LOGICA DI SELEZIONE INDIRIZZO (FIX APPLICATO)
    // Se l'evento è Manufactured o Certified, ascoltiamo l'indirizzo NFT.
    // Altrimenti ascoltiamo il Market.
    const isNftEvent = (evt === "Manufactured" || evt === "Certified");
    const targetAddr = isNftEvent ? NFT_ADDR : MARKET_ADDR;

    const res = await ffRequest("POST", "contracts/listeners", {
      name: `listener_${evt}`,
      topic: "app-events", // Deve coincidere con il filtro della subscription sopra
      location: { address: targetAddr },
      event: { name: evt }
    });
    
    if (res.status === "ERROR") {
        if (res.msg.includes("409")) {
            console.log(`   ok: ${evt} (già attivo)`);
        } else {
            console.log(`   ⚠️ Errore Listener ${evt}: ${res.msg}`);
        }
    } else {
        console.log(`   ✅ Listener ${evt}: CREATO su ${isNftEvent ? "NFT" : "MARKET"}`);
    }
  }

  console.log("\n✅ SETUP COMPLETATO CORRETTAMENTE.");
}

main().catch(e => console.error("Fatal Error:", e));