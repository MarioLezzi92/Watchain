import { apiGet, apiPost } from "../lib/api";
import { ethers } from "ethers";

// --- LETTURA ---
export async function getListings() {
  return await apiGet("/market/listings"); 
}

// --- NUOVO: PULL PAYMENTS (Crediti e Prelievi) ---
export async function getCredits() {
  return await apiGet("/market/credits");
}

export async function withdrawCredits() {
  return await apiPost("/market/withdraw", {});
}

// --- SCRITTURA PRODUCER ---
export async function mintWatch() {
  // ⚠️ Cambiato da /nft/mint a /inventory/mint
  return await apiPost("/inventory/mint", {}); 
}

export async function listPrimary(tokenId, priceLux) {
  let priceWei = "0";
  try { priceWei = ethers.parseEther(String(priceLux)).toString(); } catch {}
  return await apiPost("/market/listPrimary", { 
    tokenId: String(tokenId), 
    price: priceWei 
  });
}

// --- SCRITTURA RESELLER ---
export async function certify(tokenId) {
  // ⚠️ Cambiato da /nft/certify a /inventory/certify
  return await apiPost("/inventory/certify", { tokenId: String(tokenId) });
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
  // ⚠️ Endpoint accorciato o standardizzato nel backend v2 (check marketController)
  // Nel backend v2 marketController.js abbiamo mappato "cancelListing" su "/market/cancel"
  return await apiPost("/market/cancel", { tokenId: String(tokenId) });
}