import { apiGet, apiPost } from "../lib/api";
import { ethers } from "ethers";
import { parseLux } from "../lib/formatters";
// --- LETTURA ---
export async function getListings() {
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
export async function buy(tokenId) {
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