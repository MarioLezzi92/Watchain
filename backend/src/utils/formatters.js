// src/utils/formatters.js

/**
 * Estrae il dato utile dalle risposte di FireFly (FF).
 * Gestisce i vari formati (output, result, data) in modo che il frontend
 * riceva sempre il valore pulito.
 */
export function unwrapFFOutput(resp) {
  if (!resp) return undefined;
  const out = resp.output ?? resp.result ?? resp.data ?? resp;
  if (out == null) return undefined;
  if (typeof out === "string" || typeof out === "number" || typeof out === "boolean") return out;
  if (Array.isArray(out)) return out[0];
  if (typeof out === "object") {
    const keys = Object.keys(out);
    if (keys.length === 1) return out[keys[0]];
    return out;
  }
  return undefined;
}

/**
 * Converte stringhe o numeri in booleani reali.
 * Fondamentale per la proprietà 'certified' o altri flag della blockchain.
 */
export function parseBool(v) {
  if (typeof v === "boolean") return v;
  const s = String(v || "").trim().toLowerCase();
  return s === "true" || s === "1";
}

/**
 * Normalizza il ruolo utente per evitare errori di case-sensitivity.
 */
export function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

/**
 * CONVERSIONE DA LUX A WEI (Per inviare dati alla blockchain)
 * Prende un numero intero (es. "14") e aggiunge 18 zeri.
 * Gestisce solo numeri interi per evitare errori di precisione.
 */
export function luxToWeiString(amountLux) {
  const amount = String(amountLux || "0").trim().split('.')[0]; 
  if (amount === "0" || amount === "") return "0";
  return amount + "000000000000000000";
}

/**
 * CONVERSIONE DA WEI A LUX (Per visualizzazione nel frontend)
 * Toglie esattamente 18 cifre dalla stringa ricevuta dalla blockchain.
 * Se il valore è inferiore a 10^18, restituisce "0".
 */
export function weiToLuxString(wei) {
  const s = String(wei || "0").trim();
  
  // Se la stringa è più corta di 18 caratteri, il valore è < 1 LUX
  if (s.length <= 18) {
    // Gestione sicura per evitare stringhe vuote o errori di slice
    const pad = s.padStart(19, "0");
    const intPart = pad.slice(0, -18).replace(/^0+/, "") || "0";
    return intPart; 
  }
  
  // Ritorna la parte intera togliendo i 18 decimali
  return s.slice(0, s.length - 18); 
}