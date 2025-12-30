import { apiGet, apiPost } from "../lib/api";
import { ethers } from "ethers";

// --- LETTURA ---
export async function getListings() {
  return await apiGet("/market/listings"); 
}

// --- SCRITTURA PRODUCER ---
export async function mintWatch() {
  return await apiPost("/nft/mint", {}); 
}

export async function listPrimary(tokenId, priceLux) {
  let priceWei = "0";
  try { priceWei = ethers.parseEther(String(priceLux)).toString(); } catch {}
  return await apiPost("/market/listPrimary", { 
    tokenId: String(tokenId), 
    price: priceWei 
  });
}

// --- SCRITTURA RESELLER (Nuove Funzioni) ---
export async function certify(tokenId) {
  return await apiPost("/nft/certify", { tokenId: String(tokenId) });
}

export async function listSecondary(tokenId, priceLux) {
  let priceWei = "0";
  try { priceWei = ethers.parseEther(String(priceLux)).toString(); } catch {}
  return await apiPost("/market/listSecondary", { 
    tokenId: String(tokenId), 
    price: priceWei 
  });
}

// --- SCRITTURA COMUNE ---
export async function buy(tokenId) {
  return await apiPost("/market/buy", { tokenId: String(tokenId) });
}

export async function cancelListing(tokenId) {
  return await apiPost("/market/cancelListing", { tokenId: String(tokenId) });
}