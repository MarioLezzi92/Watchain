// frontend/src/lib/formatters.js
// SOLO INTERI: 1 LUX = 10^18 Wei

const DECIMALS = 10n ** 18n;

function isUnsignedIntegerString(s) {
  return typeof s === "string" && /^[0-9]+$/.test(s.trim());
}

/**
 * Wei -> LUX (intero, string)
 */
export function formatLux(weiValue) {
  try {
    const s = String(weiValue ?? "0").trim();
    if (s === "" || s === "0") return "0";
    if (!isUnsignedIntegerString(s)) return "0";

    return (BigInt(s) / DECIMALS).toString();
  } catch (e) {
    console.error("formatLux error:", e);
    return "0";
  }
}

/**
 * LUX (intero) -> Wei (string)
 * Qui conviene essere “strict”: se input non valido, lancia.
 * Così intercetti subito prezzo errato prima della invoke.
 */
export function parseLux(luxValue) {
  const s = String(luxValue ?? "").trim();

  if (s === "" || s === "0") return "0";
  if (!isUnsignedIntegerString(s)) {
    throw new Error("Inserisci un valore intero (es. 10). Niente decimali.");
  }

  return (BigInt(s) * DECIMALS).toString();
}

export function shortAddr(address) {
  const s = String(address || "");
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export function formatError(error, context = "GENERAL") {
  if (!error) return "Errore sconosciuto";
  const msg = (error.message || String(error)).toLowerCase();

  if (msg.includes("paused") || msg.includes("emergency")) {
    if (context === "MARKET") return "MERCATO SOSPESO: acquisto/vendita/prelievo temporaneamente bloccati.";
    if (context === "FACTORY") return "PRODUZIONE SOSPESA: minting/certificazioni non disponibili.";
    return "SISTEMA IN MANUTENZIONE: operazioni temporaneamente sospese.";
  }

  if (msg.includes("only active reseller")) return "ACCESSO NEGATO: operazione riservata ai Rivenditori Autorizzati.";
  if (msg.includes("insufficient funds") || msg.includes("0xe450d38")) return "SALDO INSUFFICIENTE: LUX non sufficienti.";
  if (msg.includes("user denied")) return "Operazione annullata dall'utente.";

  return error.message || String(error);
}
