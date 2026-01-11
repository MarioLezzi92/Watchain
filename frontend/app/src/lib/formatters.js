import { ethers } from "ethers";

/**
 * Formatta Wei in LUX (per la visualizzazione)
 * Es: "5000000000000000000" -> "5"
 * Es: "5" (wei) -> "< 0.000001"
 */
export function formatLux(weiValue) {
  try {
    if (!weiValue) return "0";
    const sVal = String(weiValue);
    if (sVal === "0") return "0";

    // ethers.formatEther dà la stringa decimale (es. "5.0" o "0.00001")
    const formatted = ethers.formatEther(sVal);

    // LOGICA STRICT INTEGER:
    // Split sul punto decimale e prende solo la prima parte (l'intero).
    // Qualsiasi cosa dopo la virgola viene ignorata.
    const [int] = formatted.split(".");
    
    return int; 
  } catch (e) {
    console.error("Format Error:", e);
    return "0";
  }
}
/**
 * Converte LUX in Wei (per inviare alla Blockchain)
 * Es: "5" -> "5000000000000000000"
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

export function shortAddr(address) {
  const s = String(address || "");
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export function formatError(error) {
  if (!error) return "Errore sconosciuto";
  if (typeof error === "string") return error;

  const msg = error?.response?.data?.error || error?.message || String(error);

  if (msg.includes("User denied")) return "Transazione rifiutata dall'utente.";
  if (msg.includes("only reseller")) {
      return "Operazione Negata: Il tuo account Reseller non è attivo.";
  }


  return msg;
}