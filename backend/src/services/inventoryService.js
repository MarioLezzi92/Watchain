import { ffQuery, ffInvoke, ffGetCore } from "./fireflyService.js";
import { unwrapFFOutput, normalizeRole, parseBool } from "../utils/formatters.js";
import { config } from "../config/env.js";

const NFT_API = "WatchNFT_API";

// --- HELPERS ---

async function ffQueryWithId(role, apiName, method, id) {
  const v = String(id);
  // Shotgun pattern: spariamo tutte le chiavi possibili per compatibilità ABI
  const input = { "": v, id: v, tokenId: v }; 
  try {
    const res = await ffQuery(role, apiName, method, input);
    return res;
  } catch (err) {
    return undefined;
  }
}

// Chiede allo Smart Contract chi è il VERO proprietario
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

// --- PUBLIC SERVICE METHODS ---

export async function getInventory(role, userAddress) {
  const targetAddr = String(userAddress).toLowerCase();

  try {
    // 1. Chiediamo a FireFly i bilanci (CACHE VELOCE)
    const balances = await ffGetCore(role, "tokens/balances", {
      key: targetAddr, 
      balance: ">0",
      limit: 50
    });

    if (!balances || balances.length === 0) return [];

    // 2. Double Check
    const promises = balances.map(async (entry) => {
      const rawId = entry.tokenIndex;
      if (!rawId) return null;

      // Controllo base su cache FireFly
      if (entry.key && String(entry.key).toLowerCase() !== targetAddr) return null;
      if (Number(entry.balance) <= 0) return null;

      // Chiede allo Smart Contract: "Di chi è questo token?"
      // Usiamo il ruolo "producer" per leggere perché è il nodo più affidabile/stabile
      const realOwner = await getOwnerOf("producer", rawId);
      
      // Se il contratto dice che il proprietario è diverso, è un "Fantasma" della cache -> SCARTA
      if (!realOwner || String(realOwner).toLowerCase() !== targetAddr) {
        return null; 
      }
      // ---------------------------------------

      const isCertified = await getCertifiedStatus(role, rawId);

      return {
        tokenId: String(rawId),
        owner: targetAddr,
        certified: isCertified,
      };
    });

    const results = await Promise.all(promises);
    return results.filter(item => item !== null);

  } catch (err) {
    console.error("Errore recupero inventario:", err.message);
    return [];
  }
}

export async function mintNft(role, toAddress) {
  const r = normalizeRole(role);
  if (r !== "producer") throw new Error("Only producer can mint");
  const recipient = toAddress || config.producerAddr; 
  return ffInvoke("producer", NFT_API, "manufacture", { to: recipient });
}

export function certifyNft(role, userAddress, tokenId) {
  const v = String(tokenId);
  return ffInvoke("reseller", NFT_API, "certify", { "": v, id: v, tokenId: v }, userAddress);
}

export async function checkResellerStatus(address) {
  try {
    const input = { "who": address, "address": address, "": address };
    const result = await ffQuery("producer", "WatchNFT_API", "reseller", input);
    return parseBool(unwrapFFOutput(result));
  } catch (err) {
    return false;
  }
}

export async function enableResellerRole(resellerAddress) {
  return ffInvoke("producer", "WatchNFT_API", "setReseller", { who: resellerAddress, enabled: true });
}

export async function setResellerRole(who, enabled) {
  if (!who) throw new Error("Missing address");
  return ffInvoke("producer", "WatchNFT_API", "setReseller", { who, enabled: Boolean(enabled) });
}

export async function getFactoryStatus() {
  try {
    const res = await ffQuery("producer", NFT_API, "paused", {}, config.producerAddr);
    return { paused: parseBool(unwrapFFOutput(res)) };
  } catch (err) { return { paused: false }; }
}

export async function setFactoryEmergency(status) {
  return ffInvoke("producer", NFT_API, "setEmergencyStop", { status: String(status) }, config.producerAddr);
}