import crypto from "crypto";
import { ethers } from "ethers";
import { env } from "../config/env.js";
import { signJwt } from "../utils/jwt.js";

// URL del nodo FireFly
const FF_NODE = "http://127.0.0.1:5000"; 

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

// --- FIX DEFINITIVO 405 ---
export async function checkResellerStatus(address) {
  try {
    if (!address) return false;

    // 1. Normalizziamo l'indirizzo
    const cleanAddr = String(address).trim().toLowerCase();
    
    const url = `${FF_NODE}/api/v1/namespaces/default/apis/WatchNFT_API/query/reseller`;
    const res = await fetch(url, {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: {
             "": cleanAddr 
        }
      })
    });

    if (res.status === 400) {
         const urlFallback = `${FF_NODE}/api/v1/namespaces/default/apis/WatchNFT_API/query/reseller?input=${cleanAddr}`;
         const resFallback = await fetch(urlFallback, {
            method: "POST", // SEMPRE POST
            headers: { "Content-Type": "application/json" }
         });
         return handleResponse(resFallback, cleanAddr);
    }

    return handleResponse(res, cleanAddr);

  } catch (e) {
    console.error("❌ [EXCEPTION]", e.message);
    return false;
  }
}

// Helper per processare la risposta ed evitare duplicazione codice
async function handleResponse(res, addr) {
    if (!res.ok) {
        const errText = await res.text();
        console.warn(`⚠️ [ERRORE FIREFLY] Status: ${res.status}. Dettagli: ${errText}`);
        return false;
    }
    
    const data = await res.json();
    const output = (data.output !== undefined) ? data.output : data;
    const isAuthorized = (output === true || output === "true");

    return isAuthorized;
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
  } else {
    const isChainReseller = await checkResellerStatus(addr);
    if (isChainReseller) {
      role = "reseller";
    }
  }

  nonces.delete(addr);
  const token = signJwt({ account: addr, role: role });

  return { token, role, address: addr };
}