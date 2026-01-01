import { apiGet, apiPost } from "../lib/api";
import { ethers } from "ethers";

export async function getBalance() {
  // Chiama /api/wallet/balance
  return await apiGet("/wallet/balance");
}

export async function transferLux(to, amountLux) {
  // Se un giorno vorrai implementare il trasferimento tra utenti (solo producer)
  let amountWei = "0";
  try { amountWei = ethers.parseEther(String(amountLux)).toString(); } catch {}
  
  return await apiPost("/wallet/transfer", {
    to,
    amountLux // Il backend si aspetta amountLux e converte, oppure amountWei. 
    // Controlla il tuo walletController backend: usa amountLux e fa la conversione interna.
  });
}