import { ethers } from "ethers";

/**
 * Formatta Wei in LUX (per la visualizzazione).
 */
export function formatLux(weiValue) {
  try {
    if (!weiValue) return "0";
    const sVal = String(weiValue);
    if (sVal === "0") return "0";

    const formatted = ethers.formatEther(sVal);
    return formatted.split(".")[0]; 
  } catch (e) {
    console.error("Format Error:", e);
    return "0";
  }
}

/**
 * Converte LUX in Wei (per inviare alla Blockchain).
 */
export function parseLux(luxValue) {
  try {
    if (!luxValue) return "0";
    return ethers.parseEther(String(luxValue)).toString();
  } catch (e) {
    console.error("Parse Error:", e);
    return "0";
  }
}

/**
 * Abbrevia gli indirizzi Ethereum
 */
export function shortAddr(address) {
  const s = String(address || "");
  if (s.length <= 12) return s; 
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

/**
 * Gestione Errori Centralizzata per la UI.
 */
export function formatError(error) {
  if (!error) return "Errore sconosciuto";
  if (typeof error === "string") return error;

  const msg = error.message || String(error);
  
  // 1. Convertiamo in minuscolo UNA VOLTA sola per fare confronti sicuri
  const lowerMsg = msg.toLowerCase(); 

  // Mappatura errori comuni (UX Friendly)
  if (lowerMsg.includes("user denied")) {
      return "Operazione annullata dall'utente.";
  }
  if (lowerMsg.includes("rejected")) {
      return "Transazione rifiutata dal wallet.";
  }
  if (lowerMsg.includes("insufficient funds")) {
      return "Fondi insufficienti per coprire il costo.";
  }
  
  // CORREZIONE QUI: Cerchiamo la stringa tutta in minuscolo
  if (lowerMsg.includes("only active reseller") || lowerMsg.includes("caller is not the reseller")) {
      return "Operazione riservata a Reseller autorizzati. Contattare il Producer.";
  }
  
  if (lowerMsg.includes("paused")) {
      return "Sistema in manutenzione. Operazione non consentita al momento.";
  }

  return msg;
}