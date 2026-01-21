import { ethers } from "ethers";

/**
 * UTILS: FORMATTERS
 * Gestione sicura dei formati dati (FireFly output, Conversioni Valuta).
 */

/**
 * Estrae il dato utile dalle risposte nidificate di FireFly.
 */
  export function unwrapFF(x) {
    if (x == null) return null;
    if (typeof x === "object" && "value" in x) return x.value;
    return x;
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