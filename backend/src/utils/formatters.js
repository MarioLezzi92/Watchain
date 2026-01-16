import { ethers } from "ethers";

/**
 * UTILS: FORMATTERS
 * Gestione sicura dei formati dati (FireFly output, Conversioni Valuta).
 */

/**
 * Estrae il dato utile dalle risposte nidificate di FireFly.
 */
export function unwrapFFOutput(resp) {
  if (!resp) return undefined;
  // FireFly può restituire dati in .output, .result o direttamente
  const out = resp.output ?? resp.result ?? resp.data ?? resp;
  
  if (out == null) return undefined;
  
  // Se è un primitivo, ritornalo
  if (typeof out === "string" || typeof out === "number" || typeof out === "boolean") return out;
  
  // Se è un array singolo (comune in Solidity), prendi il primo elemento
  if (Array.isArray(out)) return out[0];
  
  // Se è un oggetto con una sola chiave (es. { "balance": "100" }), estrai il valore
  if (typeof out === "object") {
    const keys = Object.keys(out);
    if (keys.length === 1) return out[keys[0]];
    return out;
  }
  
  return undefined;
}

/**
 * Converte in booleano (gestisce anche stringhe "true"/"1").
 */
export function parseBool(v) {
  if (typeof v === "boolean") return v;
  const s = String(v || "").trim().toLowerCase();
  return s === "true" || s === "1";
}

/**
 * Normalizza i ruoli (minuscolo e senza spazi).
 */
export function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

/**
 * CONVERSIONE SICURA: LUX -> WEI (Input Backend)
 * Usa ethers per gestire correttamente i decimali (18).
 * Es: "1.5" -> "1500000000000000000"
 */
export function luxToWeiString(amountLux) {
  try {
    if (!amountLux || amountLux === "0") return "0";
    // parseEther gestisce automaticamente i 18 decimali standard EVM
    return ethers.parseEther(String(amountLux)).toString();
  } catch (err) {
    console.error(`Errore conversione LuxToWei [${amountLux}]:`, err.message);
    throw new Error("Formato importo non valido");
  }
}

/**
 * CONVERSIONE SICURA: WEI -> LUX (Output Backend)
 * Es: "1500000000000000000" -> "1.5"
 */
export function weiToLuxString(wei) {
  try {
    if (!wei || wei === "0") return "0";
    return ethers.formatEther(String(wei));
  } catch (err) {
    console.error(`Errore conversione WeiToLux [${wei}]:`, err.message);
    return "0";
  }
}