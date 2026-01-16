import crypto from "crypto";
import { ethers } from "ethers";
import { config } from "../config/env.js";
import { signJwt } from "../utils/jwt.js";

/**
 * AUTH SERVICE
 * Gestisce la crittografia, la verifica delle firme digitali e i JWT.
 * Implementa protezione contro Memory Leaks sui nonce.
 */

// Storage temporaneo dei nonce (Address -> { nonce, exp })
const nonces = new Map();
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minuti

// --- SECURITY: GARBAGE COLLECTION ---
// Pulisce i nonce scaduti ogni 10 minuti per prevenire Memory Leaks 
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of nonces.entries()) {
    if (now > value.exp) {
      nonces.delete(key);
    }
  }
}, 10 * 60 * 1000).unref(); 

// Genera una stringa casuale sicura
function makeNonce() {
  return crypto.randomBytes(16).toString("hex");
}

// Determina il ruolo basandosi sugli indirizzi in whitelist (.env)
function determineRole(address) {
  const a = String(address || "").toLowerCase();
  
  // Confronto case-insensitive sicuro
  if (a === String(config.producerAddr).toLowerCase()) return "producer";
  if (a === String(config.resellerAddr).toLowerCase()) return "reseller";
  if (a === String(config.consumerAddr).toLowerCase()) return "consumer";
  
  return "consumer"; // Default: chi non è in lista è un semplice consumatore
}

/**
 * Genera un challenge (nonce) per l'utente che vuole loggarsi.
 */
export const generateNonce = (address) => {
  if (!address) throw new Error("Address mancante");
  
  const nonce = makeNonce();
  const exp = Date.now() + NONCE_TTL_MS;
  
  // Salviamo in memoria
  nonces.set(address.toLowerCase(), { nonce, exp });
  return nonce;
};

/**
 * Verifica la firma digitale e rilascia il token JWT.
 */
export const verifyLogin = (address, signature) => {
  if (!address || !signature) throw new Error("Dati mancanti");

  const addrNormal = address.toLowerCase();
  const entry = nonces.get(addrNormal);

  // 1. Controlli sul Nonce (Anti-Replay)
  if (!entry) throw new Error("Nonce non trovato. Richiedi un nuovo login.");
  if (Date.now() > entry.exp) {
    nonces.delete(addrNormal);
    throw new Error("Nonce scaduto.");
  }

  // 2. Verifica Crittografica (Ethers)
  const message = `Login to Watchain\nNonce: ${entry.nonce}`;
  
  let recovered;
  try {
    recovered = ethers.verifyMessage(message, signature);
  } catch (e) {
    throw new Error("Formato firma non valido.");
  }

  if (recovered.toLowerCase() !== addrNormal) {
    throw new Error("Firma non valida: Autenticazione fallita.");
  }

  // 3. Pulizia (Il nonce è monouso)
  nonces.delete(addrNormal);

  // 4. Generazione Token
  const role = determineRole(addrNormal);
  const token = signJwt({ 
    account: addrNormal, 
    role: role 
  });

  return { success: true, token, role };
};
