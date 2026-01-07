import { apiGet, apiPost } from "../lib/api";
import { ethers } from "ethers";

export async function getBalance() {
  return await apiGet("/wallet/balance");
}

export async function transferLux(to, amountLux) {
  let amountWei = "0";
  try { amountWei = ethers.parseEther(String(amountLux)).toString(); } catch {}
  
  return await apiPost("/wallet/transfer", {
    to,
    amountLux 
  });
}