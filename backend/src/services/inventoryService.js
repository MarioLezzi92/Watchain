import { ffQuery, ffInvoke, ffGetCore } from "./fireflyService.js";
import { unwrapFFOutput, normalizeRole, parseBool } from "../utils/formatters.js";
import { config } from "../config/env.js";

const NFT_API = "WatchNFT_API";

/**
 * Helper per interrogare FireFly usando il parametro 'tokenId' 
 * confermato dallo Swagger.
 */
async function ffQueryWithId(role, apiName, method, id) {
  const v = String(id);
  const input = { "": v, id: v, tokenId: v }; // Pattern universale
  try {
    const res = await ffQuery(role, apiName, method, input);
    return res;
  } catch (err) {
    console.error(`Query Error [${method}]:`, err.message);
    return undefined;
  }
}

async function getOwnerOf(role, tokenId) {
  try {
    const res = await ffQueryWithId(role, NFT_API, "ownerOf", tokenId);
    return unwrapFFOutput(res);
  } catch {
    return null; 
  }
}

async function getCertifiedStatus(role, tokenId) {
  try {
    const res = await ffQueryWithId(role, NFT_API, "certified", tokenId);
    return parseBool(unwrapFFOutput(res));
  } catch {
    return false;
  }
}

// --- Funzioni Pubbliche ---

/**
 * Recupera gli NFT dell'utente corrente usando l'indice di FireFly (Token Pool).
 * MOLTO PIÙ VELOCE: Niente cicli su nextId.
 */
/**
 * Recupera gli NFT dell'utente corrente usando l'indice di FireFly.
 * FILTRA AUTOMATICAMENTE I TOKEN ERC20 (come LUX) che non hanno ID.
 */
export async function getInventory(role, userAddress) {
  const targetAddr = String(userAddress).toLowerCase();

  try {
    // 1. Chiede a FireFly tutti i saldi (sia NFT che ERC20)
    const balances = await ffGetCore(role, "tokens/balances", {
      key: targetAddr,
      balance: ">0",
      limit: 50
    });

    if (!balances || balances.length === 0) {
      return [];
    }
    
    // Debug: vediamo cosa ci restituisce FireFly per capire meglio
    // console.log("🔍 Raw Balances from FireFly:", balances);

    // 2. Processiamo i saldi
    const promises = balances.map(async (entry) => {
      // PUNTO CRITICO: Verifichiamo se esiste un tokenIndex.
      // I token ERC20 (LuxuryCoin) NON hanno tokenIndex, quindi saranno undefined.
      const rawId = entry.tokenIndex;

      // Se non c'è ID, è spazzatura (o è una moneta), lo scartiamo.
      if (!rawId) return null;

      // Se c'è un ID, procediamo a chiedere se è certificato
      const isCertified = await getCertifiedStatus(role, rawId);

      return {
        tokenId: String(rawId),
        owner: targetAddr,
        certified: isCertified,
      };
    });

    // 3. Attendiamo tutte le promesse
    const results = await Promise.all(promises);

    // 4. Filtriamo via i 'null' (cioè le monete/errori che abbiamo scartato sopra)
    const items = results.filter(item => item !== null);

    return items;

  } catch (err) {
    console.error("Errore recupero inventario da FireFly:", err.message);
    return [];
  }
}

/**
 * Crea un nuovo NFT (Solo Producer).
 */
export async function mintNft(role, toAddress) {
  const r = normalizeRole(role);
  if (r !== "producer") throw new Error("Only producer can mint");

  const recipient = toAddress || config.producerAddr; 
  return ffInvoke("producer", NFT_API, "manufacture", { to: recipient });
}

/**
 * Certifica un NFT (Richiede ruolo Reseller).
 */
export function certifyNft(role, userAddress, tokenId) {
  const v = String(tokenId);
  return ffInvoke(
    "reseller",
    NFT_API,
    "certify",
    { "": v, id: v, tokenId: v }, // Parametri universali
    userAddress 
  );
}

/**
 * Verifica se un indirizzo è abilitato come Reseller nel contratto.
 */
export async function checkResellerStatus(address) {
  try {
    const result = await ffQuery("reseller", "WatchNFT_API", "reseller", { who: address });
    const out = unwrapFFOutput(result);
    return parseBool(out);
  } catch (err) {
    return false;
  }
}

/**
 * Abilita un indirizzo al ruolo Reseller (Solo Producer).
 */
export async function enableResellerRole(resellerAddress) {
  return ffInvoke("producer", "WatchNFT_API", "setReseller", { 
    who: resellerAddress, 
    enabled: true 
  });
}

/**
 * Assicura che un utente sia abilitato come Reseller prima di procedere.
 */
export async function ensureReseller(address) {
  const isReseller = await checkResellerStatus(address);
  if (!isReseller) {
    await enableResellerRole(address); 
  }
  return true;
}
