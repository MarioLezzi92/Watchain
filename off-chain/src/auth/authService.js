import crypto from "crypto";
import { ethers } from "ethers";
import { env } from "../../env.js";
import { signJwt } from "./jwt.js";

const nonces = new Map();

// Pulizia automatica nonce scaduti (uguale a prima)
setInterval(() => {
  const now = Date.now();
  for (const [addr, entry] of nonces.entries()) {
    if (now > entry.exp) nonces.delete(addr);
  }
}, 10 * 60 * 1000).unref();

function makeNonce() {
  return crypto.randomBytes(16).toString("hex");
}

export function generateNonce(address) {
  if (!address) throw new Error("Address mancante");
  const addr = String(address).toLowerCase();
  const nonce = makeNonce();
  nonces.set(addr, { nonce, exp: Date.now() + (env.NONCE_TTL_MS || 600000) });
  return nonce;
}

// --- VERIFY LOGIN ---
export async function verifyLogin(address, signature) {
  if (!address || !signature) throw new Error("Dati mancanti");

  const addr = String(address).toLowerCase();
  const entry = nonces.get(addr);

  // 1. Controlli sicurezza (Anti-Replay)
  if (!entry) throw new Error("Nonce non trovato.");
  if (Date.now() > entry.exp) {
    nonces.delete(addr);
    throw new Error("Nonce scaduto.");
  }

  // 2. Verifica Crittografica della Firma
  const message = `Login to Watchchain\nNonce: ${entry.nonce}`;
  let recovered;
  try {
    recovered = ethers.verifyMessage(message, signature);
  } catch {
    throw new Error("Firma non valida.");
  }

  if (String(recovered).toLowerCase() !== addr) {
    throw new Error("Firma non valida: autenticazione fallita.");
  }

  // 3. PULIZIA TOTALE: Niente più logica ruoli qui.
  // Il backend certifica solo che "Tu sei chi dici di essere".
  
  nonces.delete(addr);

  const token = signJwt({ sub: addr }); 

  return { token, address: addr };
}