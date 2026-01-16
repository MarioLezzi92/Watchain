import { ffQuery, ffInvoke, ffGetCore } from "./fireflyService.js";
import { unwrapFFOutput, parseBool } from "../utils/formatters.js";
import { config } from "../config/env.js";

const MARKET_API = "WatchMarket_API";
const NFT_API = "WatchNFT_API";
const LUX_API = "LuxuryCoin_API";

// --- EVENT SOURCING LOGIC ---

async function getEventDetails(referenceId) {
  if (!referenceId) return null;
  try {
    return await ffGetCore("producer", `blockchainevents/${referenceId}`);
  } catch (err) {
    return null;
  }
}

export async function getActiveListings() {
  try {
    const notifications = await ffGetCore("producer", "events", {
      limit: 200, 
      sort: "-created", 
      type: "blockchain_event_received" 
    });
    
    const detailPromises = notifications.map(async (note) => {
        if (!note.reference) return null;
        return await getEventDetails(note.reference);
    });

    const rawEvents = await Promise.all(detailPromises);
    
    const validEvents = rawEvents
        .filter(e => e !== null)
        .sort((a, b) => {
            const tA = new Date(a.timestamp || a.created || 0).getTime();
            const tB = new Date(b.timestamp || b.created || 0).getTime();
            return tA - tB;
        });

    const tokenState = {};

    for (const evt of validEvents) {
      const info = evt.output || (evt.info || {}).output || {}; 
      const name = evt.name || (evt.info || {}).name;
      const tokenId = info.tokenId;

      if (!tokenId) continue;
      
      if (!tokenState[tokenId]) {
        tokenState[tokenId] = { listing: null, isCertified: false };
      }

      switch (name) {
        case "Certified":
            tokenState[tokenId].isCertified = true;
            break;
        case "Listed":
            const rawType = String(info.saleType || "").toUpperCase();
            const sType = (rawType === "0" || rawType === "PRIMARY") ? "PRIMARY" : "SECONDARY";

            tokenState[tokenId].listing = {
                tokenId: String(tokenId),
                seller: info.seller,
                price: info.price, 
                saleType: sType,
            };
            break;
        case "Purchased":
        case "Canceled":
            tokenState[tokenId].listing = null; 
            break;
      }
    }

    return Object.values(tokenState)
      .filter(state => state.listing !== null)
      .map(state => ({
        ...state.listing,
        certified: state.isCertified
      }));

  } catch (err) {
    console.error("❌ Errore Market Rebuild:", err.message);
    return []; 
  }
}

// --- NEW HELPERS & LOGIC V2 ---

/** Verifica se l'orologio è certificato nel contratto NFT */
export async function isWatchCertified(tokenId) {
  try {
    const res = await ffQuery("consumer", NFT_API, "certified", { tokenId: String(tokenId) });
    return parseBool(unwrapFFOutput(res));
  } catch (err) {
    return false;
  }
}

// --- TRANSACTIONS ---

export async function checkNFTApproval(role, ownerAddress) {
  const res = await ffQuery(role, NFT_API, "isApprovedForAll", { owner: ownerAddress, operator: config.watchMarketAddress }, ownerAddress);
  return parseBool(unwrapFFOutput(res));
}

export async function approveMarketplace(role, ownerAddress) {
  return await ffInvoke(role, NFT_API, "setApprovalForAll", { operator: config.watchMarketAddress, approved: true }, ownerAddress);
}

export async function buyItem(role, userAddress, tokenId) {
  // Nota: Il prezzo non serve più come input per Firefly Invoke se non è richiesto dai parametri del metodo Solidity
  return await ffInvoke(role, MARKET_API, "buy", { tokenId: String(tokenId) }, userAddress);
}

export async function getLuxAllowance(role, ownerAddress) {
  const res = await ffQuery(role, LUX_API, "allowance", { owner: ownerAddress, spender: config.watchMarketAddress }, ownerAddress);
  return unwrapFFOutput(res);
}

export async function approveLux(role, ownerAddress) {
  const maxUint = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
  return await ffInvoke(role, LUX_API, "approve", { spender: config.watchMarketAddress, value: maxUint }, ownerAddress);
}

export async function listPrimary(tokenId, priceWei) {
  return ffInvoke("producer", MARKET_API, "listPrimary", { tokenId: String(tokenId), price: String(priceWei) }, config.producerAddr);
}

export async function listSecondary(role, tokenId, priceWei, ownerAddress) {
  // Enforcement lato client per risparmiare gas/tempo
  const certified = await isWatchCertified(tokenId);
  if (!certified) {
    throw new Error("L'orologio deve essere certificato per essere messo in vendita nel mercato secondario.");
  }
  return ffInvoke(role, MARKET_API, "listSecondary", { tokenId: String(tokenId), price: String(priceWei) }, ownerAddress);
}

export async function cancelListing(role, tokenId, ownerAddress) {
  return ffInvoke(role, MARKET_API, "cancelListing", { tokenId: String(tokenId) }, ownerAddress );
}

export async function getPendingCredits(role, address) {
  const res = await ffQuery(role, MARKET_API, "creditsOf", { payee: address }, address);
  return unwrapFFOutput(res) || "0";
}

export async function withdrawCredits(role, address) {
  return ffInvoke(role, MARKET_API, "withdraw", {}, address);
}

export async function getMarketStatus() {
  try {
    const res = await ffQuery("producer", MARKET_API, "paused", {}, config.producerAddr);
    return { paused: parseBool(unwrapFFOutput(res)) };
  } catch (err) {
    return { paused: false };
  }
}

export async function setMarketEmergency(status) {
  return ffInvoke("producer", MARKET_API, "setEmergencyStop", { status: String(status) }, config.producerAddr);
}