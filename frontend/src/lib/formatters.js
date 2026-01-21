import { ethers } from "ethers";

// COSTANTE: 1 LUX = 10^18 unità base
const DECIMALS = 1000000000000000000n; // 18 zeri

/**
 * Dalla Blockchain al Frontend (Visualizzazione)
 * Divide per 10^18 e restituisce solo la parte intera.
 * Es: 15000000000000000000 Wei -> "15" LUX
 */
export function formatLux(weiValue) {
  try {
    if (!weiValue) return "0";
    // Divisione intera BigInt: taglia via qualsiasi decimale
    const lux = BigInt(weiValue) / DECIMALS;
    return lux.toString(); 
  } catch (e) {
    console.error("Format Error:", e);
    return "0";
  }
}

/**
 * Dal Frontend alla Blockchain (Input)
 * Moltiplica l'input utente per 10^18.
 * Es: "15" LUX -> 15000000000000000000 Wei
 */
export function parseLux(luxValue) {
  try {
    if (!luxValue) return "0";
    // Moltiplicazione BigInt
    const wei = BigInt(luxValue) * DECIMALS;
    return wei.toString();
  } catch (e) {
    console.error("Parse Error:", e);
    return "0";
  }
}

export function shortAddr(address) {
  const s = String(address || "");
  if (s.length <= 12) return s; 
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export function formatError(error, context = "GENERAL") {
  if (!error) return "Errore sconosciuto";
  
  const msg = (error.message || String(error)).toLowerCase();

  // 1. GESTIONE PAUSA (Differenziata per contesto)
  if (msg.includes("paused") || msg.includes("emergency")) {
    if (context === "MARKET") {
      return "MERCATO SOSPESO: Le operazioni di acquisto, vendita e prelievo sono momentaneamente bloccate.";
    }
    if (context === "FACTORY") {
      return "PRODUZIONE SOSPESA: Il minting e le certificazioni non sono disponibili al momento.";
    }
    // Fallback se non specifichiamo il contesto (o blocco totale)
    return "SISTEMA IN MANUTENZIONE: Tutte le operazioni sono temporaneamente sospese.";
  }

  // 2. ERRORI SPECIFICI ESISTENTI
  if (msg.includes("user denied")) return "Operazione annullata dall'utente.";
  
  if (msg.includes("only active reseller")) {
    return "ACCESSO NEGATO: Operazione riservata ai Rivenditori Autorizzati.";
  }

  if (msg.includes("insufficient funds") || msg.includes("0xe450d38")) {
    return "SALDO INSUFFICIENTE: Non hai abbastanza LUX per questa operazione.";
  }

  // Fallback generico
  return error.message || String(error);
}