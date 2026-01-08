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


export async function getInventory(role, userAddress) {
  const targetAddr = String(userAddress).toLowerCase();

  try {
    const balances = await ffGetCore(role, "tokens/balances", {
      key: targetAddr, 
      balance: ">0",
      limit: 50
    });

    if (!balances || balances.length === 0) {
      return [];
    }

    const promises = balances.map(async (entry) => {
      const rawId = entry.tokenIndex;

      if (!rawId) return null;

      if (entry.key && String(entry.key).toLowerCase() !== targetAddr) {
         return null;
      }

      if (Number(entry.balance) <= 0) return null;

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
    const role = "producer";

    const input = { 
      "who": address, 
      "address": address,
      "": address 
    };

    const result = await ffQuery(role, "WatchNFT_API", "reseller", input);
    const out = unwrapFFOutput(result);
    return parseBool(out);

  } catch (err) {
    console.error(`Errore checkResellerStatus [${address}]:`, err.message);
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


export async function setResellerRole(who, enabled) {
  if (!who) throw new Error("Missing address");
  return ffInvoke("producer", "WatchNFT_API", "setReseller", {
    who,
    enabled: Boolean(enabled),
  });
}

export async function getFactoryStatus() {
  try {
    const res = await ffQuery("producer", NFT_API, "paused", {}, config.producerAddr);
    return { paused: parseBool(unwrapFFOutput(res)) };
  } catch (err) {
    console.error("Errore getFactoryStatus:", err);
    return { paused: false };
  }
}

export async function setFactoryEmergency(status) {
  return ffInvoke("producer", NFT_API, "setEmergencyStop", { status: String(status) }, config.producerAddr);
}