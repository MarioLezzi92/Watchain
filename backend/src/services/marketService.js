import { ffQuery, ffInvoke, ffGetCore } from "./fireflyService.js";
import { unwrapFFOutput, parseBool } from "../utils/formatters.js";
import { config } from "../config/env.js";

const MARKET_API = "WatchMarket_API";
const NFT_API = "WatchNFT_API";
const LUX_API = "LuxuryCoin_API";

/**
 * Helper: Recupera i dettagli completi dell'evento dal riferimento.
 * Endpoint confermato: 'blockchainevents'
 */
async function getEventDetails(referenceId) {
  if (!referenceId) return null;
  try {
    return await ffGetCore("producer", `blockchainevents/${referenceId}`);
  } catch (err) {
    // Se un evento specifico fallisce, lo ignoriamo senza rompere tutto il flusso
    return null;
  }
}

/**
 * Funzione Principale: EDA Market
 * Scarica le notifiche, recupera i dettagli in parallelo e ricostruisce lo stato.
 */
export async function getActiveListings() {
  try {
    // 1. Scarica le notifiche (Buste leggere)
    const notifications = await ffGetCore("producer", "events", {
      limit: 200, 
      sort: "-created", 
      type: "blockchain_event_received" 
    });
    
    // 2. Scarica i dettagli completi in parallelo (Velocissimo su DB locale)
    const detailPromises = notifications.map(async (note) => {
        if (!note.reference) return null;
        return await getEventDetails(note.reference);
    });

    const rawEvents = await Promise.all(detailPromises);
    const validEvents = rawEvents.filter(e => e !== null);

    // 3. Ordina (Vecchio -> Nuovo) per ricostruire la storia
    validEvents.sort((a, b) => {
        const tA = a.timestamp || a.created || 0;
        const tB = b.timestamp || b.created || 0;
        return tA > tB ? 1 : -1;
    });

    // 4. Ricostruzione Stato (Event Sourcing)
    const tokenState = {};

    for (const evt of validEvents) {
      // Estrazione dati sicura (gestisce formati diversi di output)
      const info = evt.output || (evt.info || {}).output || {}; 
      const name = evt.name || (evt.info || {}).name;
      const tokenId = info.tokenId;

      if (!tokenId) continue;
      
      // Inizializza stato se nuovo
      if (!tokenState[tokenId]) {
        tokenState[tokenId] = { listing: null, isCertified: false };
      }

      // Aggiorna stato in base all'evento
      if (name === "Certified") {
        tokenState[tokenId].isCertified = true;
      } 
      else if (name === "Listed") {
        tokenState[tokenId].listing = {
          tokenId: String(tokenId),
          seller: info.seller,
          price: info.price,
          saleType: (String(info.saleType) === "0" || String(info.saleType).toUpperCase() === "PRIMARY") ? "PRIMARY" : "SECONDARY",
        };
      } 
      else if (name === "Purchased" || name === "Canceled") {
        tokenState[tokenId].listing = null;
      }
    }

    const activeListings = Object.values(tokenState)
      .filter(state => state.listing !== null)
      .map(state => ({
        ...state.listing,
        certified: state.isCertified
      }));

    return activeListings;

  } catch (err) {
    console.error("❌ Errore Market:", err.message);
    return [];
  }
}

// -----------------------------------------------------------
// TRANSAZIONI (Codice Invariato)
// -----------------------------------------------------------

export async function checkNFTApproval(role, ownerAddress) {
  const res = await ffQuery(role, NFT_API, "isApprovedForAll", { owner: ownerAddress, operator: config.watchMarketAddress }, ownerAddress);
  return parseBool(unwrapFFOutput(res));
}

export async function approveMarketplace(role, ownerAddress) {
  return await ffInvoke(role, NFT_API, "setApprovalForAll", { operator: config.watchMarketAddress, approved: true }, ownerAddress);
}

export async function buyItem(role, userAddress, tokenId, priceWei) {
  const allowanceRes = await ffQuery(role, LUX_API, "allowance", { owner: userAddress, spender: config.watchMarketAddress }, userAddress);
  
  if (BigInt(unwrapFFOutput(allowanceRes) || "0") < BigInt(priceWei)) {
    const maxUint = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
    await ffInvoke(role, LUX_API, "approve", { spender: config.watchMarketAddress, value: maxUint }, userAddress);
  }
  return await ffInvoke(role, MARKET_API, "buy", { tokenId: String(tokenId) }, userAddress);
}

export async function listPrimary(role, tokenId, priceLux) {
  return ffInvoke("producer", MARKET_API, "listPrimary", { tokenId: String(tokenId), price: String(priceLux) }, config.producerAddr);
}

export async function listSecondary(role, tokenId, priceLux, ownerAddress) {
  return ffInvoke(role, MARKET_API, "listSecondary", { tokenId: String(tokenId), price: String(priceLux) }, ownerAddress);
}

export async function cancelListing(role, tokenId, ownerAddress) {
  return ffInvoke(role, MARKET_API, "cancelListing", { tokenId: String(tokenId) }, ownerAddress );
}

export async function getPendingCredits(role, address) {
  const res = await ffQuery(role, MARKET_API, "creditsOf", { payee: address }, address);
  return (BigInt(unwrapFFOutput(res) || "0") / 10n**18n).toString();
}

export async function withdrawCredits(role, address) {
  return ffInvoke(role, MARKET_API, "withdraw", {}, address);
}