import crypto from "crypto";
import { ethers } from "ethers";
import { env } from "../config/env.js";
import { signJwt } from "../utils/jwt.js";


const nonces = new Map();

// Pulizia nonce scaduti
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

  if (!entry) throw new Error("Nonce non trovato.");
  if (Date.now() > entry.exp) {
    nonces.delete(addr);
    throw new Error("Nonce scaduto.");
  }

  // Verifica della firma 
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

  const PRODUCER = String(env.PRODUCER_ADDR || "").toLowerCase().trim();
  const RESELLER_ENV = String(env.RESELLER_ADDR || "").toLowerCase().trim();

  let role = "consumer"; 

  if (addr === PRODUCER) {
    role = "producer";
  } else if (addr === RESELLER_ENV) {
    role = "reseller";
  } 
  
  nonces.delete(addr);
  const token = signJwt({ account: addr, role: role });

  return { token, role, address: addr };
}