import { ffQuery, ffInvoke } from "./fireflyService.js";
import { unwrapFFOutput, normalizeRole, isAddress, parseBool } from "../utils/formatters.js";
import { config } from "../config/env.js";

const NFT_API = "WatchNFT_API";

// --- Helpers ---

// Helper potenziato per trovare il parametro giusto
async function ffQueryWithFallback(role, apiName, method, tokenId) {
  const t = String(tokenId);
  
  // Lista di tentativi per indovinare come FireFly vuole il parametro input
  const attempts = [
    { tokenId: t },  // Standard nome parametro
    { "": t },       // Parametro anonimo vuoto
    { "0": t },      // Parametro posizionale stringa
    { arg0: t },     // Parametro generato arg0
    { _0: t },       // Parametro generato _0
    { key: t },      // Chiave per mapping
    { input: t }     // Input diretto
  ];

  let lastErr;
  for (const input of attempts) {
    try {
      const res = await ffQuery(role, apiName, method, input);
      // Se otteniamo una risposta valida (non errore), la ritorniamo
      if (res) return res;
    } catch (e) {
      lastErr = e;
      // Continua col prossimo tentativo
    }
  }
  // Se falliscono tutti, ritorna undefined (verrà gestito dal chiamante)
  return undefined; 
}

async function getOwnerOf(role, tokenId) {
  try {
    const res = await ffQueryWithFallback(role, NFT_API, "ownerOf", tokenId);
    return unwrapFFOutput(res);
  } catch {
    return null; 
  }
}

async function getCertifiedStatus(role, tokenId) {
  try {
    const res = await ffQueryWithFallback(role, NFT_API, "certified", tokenId);
    // Assicuriamoci di parsare bene il booleano
    return parseBool(unwrapFFOutput(res));
  } catch {
    return false;
  }
}

// --- Funzioni Pubbliche ---

export async function getInventory(role, userAddress) {
  const r = normalizeRole(role);
  const targetAddr = String(userAddress).toLowerCase();
  
  const nextIdRes = await ffQuery(r, NFT_API, "nextId", {});
  const nextId = Number(unwrapFFOutput(nextIdRes) || 0);

  const items = [];

  for (let i = 1; i <= nextId; i++) {
    // Parallelizziamo le query per velocità
    const [ownerRaw, isCertified] = await Promise.all([
      getOwnerOf(r, i),
      getCertifiedStatus(r, i)
    ]);

    const owner = String(ownerRaw || "").toLowerCase();

    // Filtriamo: mostriamo solo se l'utente è il proprietario
    if (owner === targetAddr) {
      items.push({
        tokenId: String(i),
        owner,
        certified: isCertified, // Qui ora dovrebbe arrivare true!
      });
    }
  }

  return items;
}

export async function mintNft(role, toAddress) {
  const r = normalizeRole(role);
  if (r !== "producer") throw new Error("Only producer can mint");

  const recipient = toAddress || config.producerAddr; 
  if (!isAddress(recipient)) throw new Error("Invalid recipient address");

  return ffInvoke("producer", NFT_API, "manufacture", { to: recipient });
}

export async function certifyNft(role, tokenId) {
  const r = normalizeRole(role);
  if (r !== "reseller") throw new Error("Only reseller can certify");

  return ffInvoke("reseller", NFT_API, "certify", { tokenId: String(tokenId) });
}