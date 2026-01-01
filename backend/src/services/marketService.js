import { ffQuery, ffInvoke } from "./fireflyService.js";
import { unwrapFFOutput, normalizeRole, isAddress, parseBool } from "../utils/formatters.js";
import { config } from "../config/env.js";

const MARKET_API = "WatchMarket_API";
const NFT_API = "WatchNFT_API";
const LUX_API = "LuxuryCoin_API";

// --- Helpers Interni ---

/**
 * Helper fondamentale per indovinare come FireFly vuole il parametro input.
 * Prova diverse varianti finché una non risponde 200 OK.
 */
async function ffQueryWithFallback(role, apiName, method, value) {
  const v = String(value);
  
  const attempts = [
    { tokenId: v },   // Standard nome parametro
    { key: v },       // Chiave per mapping (spesso usata da FireFly)
    { input: v },     // Input generico
    { "": v },        // Parametro anonimo
    { "0": v }        // Parametro posizionale
  ];

  let lastErr;
  for (const input of attempts) {
    try {
      const res = await ffQuery(role, apiName, method, input);
      if (res) return res;
    } catch (e) {
      lastErr = e;
      // Continua col prossimo tentativo...
    }
  }
  // Se arriviamo qui, hanno fallito tutti. 
  // Rilanciamo l'errore per farlo gestire al chiamante (o logs)
  throw lastErr; 
}

function normalizeSaleType(v) {
  const s = String(v || "").toUpperCase();
  if (s === "0") return "PRIMARY";
  if (s === "1") return "SECONDARY";
  if (s.includes("PRIMARY")) return "PRIMARY";
  if (s.includes("SECONDARY")) return "SECONDARY";
  return "UNKNOWN";
}

async function ensureMarketEnabled(role, ownerAddress) {
  const r = normalizeRole(role);
  if (r !== "producer" && r !== "reseller") return;

  // Anche qui usiamo il fallback per sicurezza su 'owner'
  // ma di solito isApprovedForAll ha nomi parametri stabili (owner, operator)
  const isApprovedRes = await ffQuery(r, NFT_API, "isApprovedForAll", {
    owner: ownerAddress,
    operator: config.watchMarketAddress,
  });

  const isApproved = parseBool(unwrapFFOutput(isApprovedRes));

  if (!isApproved) {
    console.log(`[Market] Enabling NFT approval for ${r}...`);
    await ffInvoke(r, NFT_API, "setApprovalForAll", {
      operator: config.watchMarketAddress,
      approved: true,
    });
  }
}

async function approveLux(role, owner, amountWei) {
  const r = normalizeRole(role);
  const spender = config.watchMarketAddress;

  const allowanceRes = await ffQuery(r, LUX_API, "allowance", {
    owner,
    spender,
  });
  const currentAllowance = String(unwrapFFOutput(allowanceRes) || "0");

  if (currentAllowance !== "0") {
    await ffInvoke(r, LUX_API, "approve", { spender, value: "0" });
  }

  return ffInvoke(r, LUX_API, "approve", { spender, value: String(amountWei) });
}

// --- Funzioni Pubbliche ---

export async function getActiveListings() {
  const nextIdRes = await ffQuery("producer", NFT_API, "nextId", {});
  const nextId = Number(unwrapFFOutput(nextIdRes) || 0);

  const listings = [];

  for (let id = 1; id <= nextId; id++) {
    try {
      // 1. Leggi i dati della vendita
      const res = await ffQuery("reseller", MARKET_API, "getListing", { tokenId: String(id) });
      const raw = unwrapFFOutput(res);

      if (raw && parseBool(raw.exists)) {
        
        // 2. CORREZIONE: Usa ffQueryWithFallback per leggere 'certified'
        let isCertified = false;
        try {
            // Qui usiamo la funzione robusta invece di ffQuery diretta
            const certRes = await ffQueryWithFallback("producer", NFT_API, "certified", id);
            isCertified = parseBool(unwrapFFOutput(certRes));
        } catch (err) {
            // Logghiamo meno aggressivamente (warn invece di error) per pulizia
            // console.warn(`Could not fetch cert status for #${id}`, err.message);
        }

        listings.push({
          tokenId: String(id),
          seller: raw.seller,
          price: raw.price,
          saleType: normalizeSaleType(raw.saleType),
          certified: isCertified, 
        });
      }
    } catch (e) {
      // Ignora token non listati
    }
  }
  return listings;
}

export async function listPrimary(role, tokenId, price) {
  if (normalizeRole(role) !== "producer") throw new Error("Only producer can list primary");
  
  await ensureMarketEnabled(role, config.producerAddr);

  return ffInvoke("producer", MARKET_API, "listPrimary", {
    tokenId: String(tokenId),
    price: String(price),
  });
}

export async function listSecondary(role, tokenId, price) {
  if (normalizeRole(role) !== "reseller") throw new Error("Only reseller can list secondary");

  await ensureMarketEnabled(role, config.resellerAddr);

  return ffInvoke("reseller", MARKET_API, "listSecondary", {
    tokenId: String(tokenId),
    price: String(price),
  });
}

export async function cancelListing(role, tokenId) {
  const r = normalizeRole(role);
  if (r !== "producer" && r !== "reseller") throw new Error("Unauthorized");
  
  return ffInvoke(r, MARKET_API, "cancelListing", { tokenId: String(tokenId) });
}

export async function buyItem(role, userAddress, tokenId, priceWei) {
  const r = normalizeRole(role);
  if (r !== "reseller" && r !== "consumer") throw new Error("Unauthorized buyer");

  await approveLux(r, userAddress, priceWei);

  return ffInvoke(r, MARKET_API, "buy", { tokenId: String(tokenId) });
}

export async function getPendingCredits(role, address) {
  const r = normalizeRole(role);
  if (!isAddress(address)) throw new Error("Invalid address");

  const res = await ffQuery(r, MARKET_API, "creditsOf", { payee: address });
  return unwrapFFOutput(res) || "0";
}

export async function withdrawCredits(role) {
  const r = normalizeRole(role);
  return ffInvoke(r, MARKET_API, "withdraw", {});
}

export async function pauseMarket(role) {
  if (normalizeRole(role) !== "producer") throw new Error("Only admin");
  return ffInvoke("producer", MARKET_API, "pause", {});
}

export async function unpauseMarket(role) {
  if (normalizeRole(role) !== "producer") throw new Error("Only admin");
  return ffInvoke("producer", MARKET_API, "unpause", {});
}