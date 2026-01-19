import { apiGet, apiPost } from "../lib/api";
import { parseLux } from "../lib/formatters";

// --- LETTURA ---
// Rinominata da getListings a getActiveListings per allinearsi a MarketPage.jsx
export async function getActiveListings() {
  return await apiGet("/market/listings"); 
}

// --- PULL PAYMENTS (Crediti e Prelievi) ---
export async function getCredits() {
  return await apiGet("/market/credits");
}

export async function withdrawCredits() {
  return await apiPost("/market/withdraw", {});
}

// --- SCRITTURA PRODUCER ---
export async function mintWatch() {
  return await apiPost("/inventory/mint", {}); 
}

export async function listPrimary(tokenId, priceLux) {
  const priceWei = parseLux(priceLux);
  return await apiPost("/market/listPrimary", { 
    tokenId, 
    price: priceWei 
  });
}

// --- SCRITTURA RESELLER ---
export async function certify(tokenId) {
  return await apiPost("/inventory/certify", { tokenId: String(tokenId) });
}

export async function listSecondary(tokenId, priceLux) {
  const priceWei = parseLux(priceLux);
  return await apiPost("/market/listSecondary", { 
    tokenId, 
    price: priceWei 
  });
}

// --- SCRITTURA COMUNE ---
// Rinominata da buy a buyItem per allinearsi a MarketPage.jsx
export async function buyItem(role, address, tokenId) {
  return await apiPost("/market/buy", { tokenId: String(tokenId) });
}

export async function cancelListing(tokenId) {
  return await apiPost("/market/cancel", { tokenId: String(tokenId) });
}

export async function setReseller(who, enabled = true) {
  return await apiPost("/inventory/set-reseller", {
    who,
    enabled,
  });
}

export async function getResellerStatus(address) {
  return await apiGet(`/inventory/is-reseller?address=${address}`);
}

export async function getApprovalStatus() {
  return await apiGet("/market/approval-status");
}

export async function approveMarket() {
  return await apiPost("/market/approve-market", {});
}

export async function getBackendConfig() {
  return await apiGet("/auth/config");
}

export async function checkLuxAllowance() {
  return await apiGet("/market/allowance");
}

export async function approveLux() {
  return await apiPost("/market/approve-lux");
}