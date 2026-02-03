import crypto from "crypto";
import { ethers } from "ethers";
import { env } from "../../env.js";
import { signAccessJwt, signRefreshJwt, verifyRefreshJwt } from "./jwt.js";

// Storage in-memory per i Nonce (Challenge temporanei)
const nonces = new Map();

// Refresh Token Store (Whitelist/Blacklist logic).
// Nota Architetturale: Utilizziamo una Map in-memory per semplicità dimostrativa.
// In produzione, questo stato andrebbe su Redis per permettere lo scaling orizzontale.
const refreshStore = new Map(); // address -> currentJti (JWT ID)

// Garbage Collector: Pulisce i nonce scaduti ogni 10 minuti
setInterval(() => {
  const now = Date.now();
  for (const [addr, entry] of nonces.entries()) {
    if (now > entry.exp) nonces.delete(addr);
  }
}, 10 * 60 * 1000).unref();

// Helpers crittografici
function makeNonce() { return crypto.randomBytes(16).toString("hex"); }
function makeJti() { return crypto.randomBytes(16).toString("hex"); }
function makeCsrf() { return crypto.randomBytes(32).toString("hex"); }

/**
 * Step 1 Auth: Generazione Nonce.
 * Crea una stringa casuale associata all'address per prevenire Replay Attacks.
 * Il nonce ha una validità temporale limitata (TTL).
 */
export function generateNonce(address) {
  if (!address) throw new Error("Address mancante");
  const addr = String(address).toLowerCase();
  const nonce = makeNonce();
  nonces.set(addr, { nonce, exp: Date.now() + (env.NONCE_TTL_MS || 600000) });
  return nonce;
}

/**
 * Step 2 Auth: Verifica Firma.
 * Recupera il nonce originale e verifica che la firma sia stata generata
 * dalla chiave privata associata all'indirizzo pubblico fornito.
 */
export async function verifyLogin(address, signature) {
  if (!address || !signature) throw new Error("Dati mancanti");

  const addr = String(address).toLowerCase();
  const entry = nonces.get(addr);

  // Verifica esistenza e scadenza del Nonce
  if (!entry) throw new Error("Nonce non trovato.");
  if (Date.now() > entry.exp) {
    nonces.delete(addr);
    throw new Error("Nonce scaduto.");
  }

  // Ricostruzione messaggio firmato
  const message = `Login to Watchchain\nNonce: ${entry.nonce}`;
  let recovered;
  try {
    // Ethers.js recupera l'address pubblico dal digest della firma
    recovered = ethers.verifyMessage(message, signature);
  } catch {
    throw new Error("Firma non valida.");
  }

  if (String(recovered).toLowerCase() !== addr) {
    throw new Error("Firma non valida: autenticazione fallita.");
  }

  // Cleanup nonce usato (Monouso)
  nonces.delete(addr);

  // Inizializzazione Sessione con Refresh Token Rotation
  const jti = makeJti();
  refreshStore.set(addr, jti); // Salviamo l'ID del token valido

  const accessToken = signAccessJwt(addr);
  const refreshToken = signRefreshJwt(addr, jti);
  const csrfToken = makeCsrf();

  return { address: addr, accessToken, refreshToken, csrfToken };
}

/**
 * Implementazione Refresh Token Rotation.
 * Ogni volta che il token viene usato, ne viene emesso uno nuovo e il precedente invalidato.
 * Se un token vecchio viene riusato, è indice di furto: il sistema blocca l'utente.
 */
export function refreshSession(refreshToken) {
  if (!refreshToken) throw new Error("Missing refresh token");

  const payload = verifyRefreshJwt(refreshToken);
  const addr = String(payload?.sub || "").toLowerCase();
  const jti = payload?.jti;

  if (!addr || !jti) throw new Error("Invalid refresh token");
  
  // Verifica contro lo store server-side (Revoca immediata)
  const current = refreshStore.get(addr);
  if (!current || current !== jti) {
      // Scenario: Token Reuse Detection (Possibile furto di sessione)
      // Azione: Invalidare l'intera sessione
      refreshStore.delete(addr); 
      throw new Error("Refresh token revoked/rotated (Security Alert)");
  }

  // Rotazione: Genera nuovo JTI
  const newJti = makeJti();
  refreshStore.set(addr, newJti);

  const accessToken = signAccessJwt(addr);
  const newRefreshToken = signRefreshJwt(addr, newJti);
  const csrfToken = makeCsrf();

  return { address: addr, accessToken, refreshToken: newRefreshToken, csrfToken };
}

export function revokeRefresh(address) {
  if (!address) return;
  refreshStore.delete(String(address).toLowerCase());
}