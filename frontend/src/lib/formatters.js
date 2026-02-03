// frontend/src/lib/formatters.js
// Gestione precisione numerica per Blockchain (EVM).
// Utilizzo di BigInt per evitare errori di virgola mobile (es. 0.1 + 0.2 != 0.3) tipici di JS.
// 1 LUX = 10^18 Wei

const DECIMALS = 10n ** 18n;

function isUnsignedIntegerString(s) {
  return typeof s === "string" && /^[0-9]+$/.test(s.trim());
}

/**
 * Wei -> LUX (Visualizzazione)
 * Converte da intero on-chain (BigInt) a stringa leggibile per la UI.
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
 * LUX -> Wei (Input Transazione)
 * Converte input utente in formato raw per lo Smart Contract.
 * Strict Mode: Rifiuta decimali per semplificare la logica di business on-chain.
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

/**
 * Error Mapping: Translation Layer.
 * Traduce i "revert reasons" criptici dello Smart Contract (es. "0xe450d38")
 * in messaggi utente comprensibili in linguaggio naturale.
 */
export function formatError(error, context = "GENERAL") {
  if (!error) return "Errore sconosciuto";
  const msg = (error.message || String(error)).toLowerCase();

  // --- ERRORI DI SISTEMA (Pausable / Emergency Stop) ---
  if (msg.includes("paused") || msg.includes("emergency")) {
    if (context === "MARKET") return "MERCATO SOSPESO: acquisto/vendita/prelievo temporaneamente bloccati.";
    if (context === "FACTORY") return "PRODUZIONE SOSPESA: minting/certificazioni non disponibili.";
    return "SISTEMA IN MANUTENZIONE: operazioni temporaneamente sospese.";
  }
  
  // --- ERRORI UTENTE / WALLET ---
  if (msg.includes("user denied") || msg.includes("rejected")) return "Operazione annullata dall'utente.";
  if (msg.includes("insufficient funds") || msg.includes("0xe450d38")) return "SALDO INSUFFICIENTE: LUX non sufficienti.";
  
  // --- ERRORI DI DOMINIO (Business Logic) ---
  if (msg.includes("market not approved")) return "APPROVAZIONE MANCANTE: Devi approvare il Market prima di mettere in vendita.";
  if (msg.includes("only active reseller")) return "OPERAZIONE NEGATA: Solo i Reseller Autorizzati possono eseguire questa operazione.";
  if (msg.includes("seller disabled")) return "ACQUISTO NEGATO: Stai provando ad acquistare da un Reseller non autorizzato.";
  if (msg.includes("not in escrow")) return "ERRORE CRITICO: L'orologio non è nell'Escrow del market.";
  if (msg.includes("not owner")) return "NON SEI IL PROPRIETARIO: Non possiedi questo orologio.";
  if (msg.includes("already listed")) return "GIÀ IN VENDITA: Questo orologio è già listato.";
  if (msg.includes("only certified")) return "NON CERTIFICATO: Devi certificare l'orologio prima di venderlo.";
  
  return error.message || String(error);
}