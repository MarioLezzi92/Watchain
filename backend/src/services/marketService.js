import { ffQuery, ffInvoke } from "./fireflyService.js";
import { unwrapFFOutput, normalizeRole, parseBool, weiToLuxString } from "../utils/formatters.js";
import { config } from "../config/env.js";

const MARKET_API = "WatchMarket_API";
const NFT_API = "WatchNFT_API";
const LUX_API = "LuxuryCoin_API";

async function ffQueryWithId(role, apiName, method, id, userAddress = "") {
  const v = String(id);
  const input = { "": v, tokenId: v, id: v };
  return await ffQuery(role, apiName, method, input, userAddress);
}

export async function checkNFTApproval(role, ownerAddress) {
  const res = await ffQuery(normalizeRole(role), NFT_API, "isApprovedForAll", { owner: ownerAddress, operator: config.watchMarketAddress }, ownerAddress);
  return parseBool(unwrapFFOutput(res));
}

export async function approveMarketplace(role, ownerAddress) {
  return await ffInvoke(normalizeRole(role), NFT_API, "setApprovalForAll", { operator: config.watchMarketAddress, approved: true }, ownerAddress);
}

export async function buyItem(role, userAddress, tokenId, priceWei) {
  const allowanceRes = await ffQuery(normalizeRole(role), LUX_API, "allowance", { owner: userAddress, spender: config.watchMarketAddress }, userAddress);
  if (BigInt(unwrapFFOutput(allowanceRes) || "0") < BigInt(priceWei)) {
    const maxUint = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
    await ffInvoke(normalizeRole(role), LUX_API, "approve", { spender: config.watchMarketAddress, value: maxUint }, userAddress);
  }
  return await ffInvoke(normalizeRole(role), MARKET_API, "buy", { tokenId: String(tokenId) }, userAddress);
}

export async function getActiveListings() {
  try {
    const nextIdRes = await ffQuery("producer", NFT_API, "nextId", {}, "");
    const nextId = Number(unwrapFFOutput(nextIdRes) || 0);
    const listings = [];
    for (let id = 1; id <= nextId; id++) {
      try {
        const res = await ffQueryWithId("reseller", MARKET_API, "getListing", id);
        const raw = unwrapFFOutput(res);
        if (raw && raw.seller && !String(raw.seller).startsWith("0x00000000")) {
          const certRes = await ffQueryWithId("producer", NFT_API, "certified", id);
          listings.push({
            tokenId: String(id),
            seller: raw.seller,
            price: raw.price,
            saleType: raw.saleType === "0" || String(raw.saleType).includes("PRIMARY") ? "PRIMARY" : "SECONDARY",
            certified: parseBool(unwrapFFOutput(certRes)),
          });
        }
      } catch (e) {}
    }
    return listings;
  } catch (err) { return []; }
}

export async function listPrimary(role, tokenId, priceLux) {
  return ffInvoke("producer", MARKET_API, "listPrimary", { tokenId: String(tokenId), price: String(priceLux) }, config.producerAddr);
}

export async function listSecondary(role, tokenId, priceLux, ownerAddress) {
  return ffInvoke(normalizeRole(role), MARKET_API, "listSecondary", { tokenId: String(tokenId), price: String(priceLux) }, ownerAddress);
}

export async function cancelListing(role, tokenId, ownerAddress) {
  return ffInvoke(normalizeRole(role), MARKET_API, "cancelListing", { tokenId: String(tokenId) }, ownerAddress );
}


export async function getPendingCredits(role, address) {
  const res = await ffQuery(normalizeRole(role), MARKET_API, "creditsOf", { payee: address }, address);
  return weiToLuxString(unwrapFFOutput(res) || "0");
}

export async function withdrawCredits(role, address) {
  return ffInvoke(normalizeRole(role), MARKET_API, "withdraw", {}, address);
}

export async function ensureNFTApproval(role, ownerAddress) {
  const approved = await checkNFTApproval(role, ownerAddress);
  if (!approved) await approveMarketplace(role, ownerAddress);
  return true;
}