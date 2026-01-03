import crypto from "crypto";
import { ethers } from "ethers";
import { config } from "../config/env.js";
import { signJwt } from "../utils/jwt.js";

const nonces = new Map();
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minuti

function makeNonce() {
  return crypto.randomBytes(16).toString("hex");
}

function determineRole(address) {
  const a = String(address).toLowerCase();
  if (a === String(config.producerAddr).toLowerCase()) return "producer";
  if (a === String(config.resellerAddr).toLowerCase()) return "reseller";
  if (a === String(config.consumerAddr).toLowerCase()) return "consumer";
  return "consumer"; // Ruolo di default se non in whitelist
}

export const generateNonce = (address) => {
  const nonce = makeNonce();
  const exp = Date.now() + NONCE_TTL_MS;
  nonces.set(address.toLowerCase(), { nonce, exp });
  return nonce;
};

export const verifyLogin = (address, signature) => {
  const addrNormal = address.toLowerCase();
  const entry = nonces.get(addrNormal);

  if (!entry) throw new Error("Nonce not found");
  if (Date.now() > entry.exp) {
    nonces.delete(addrNormal);
    throw new Error("Nonce expired");
  }

  const message = `Login to WatchDApp\nNonce: ${entry.nonce}`;
  
  // Verifica della firma crittografica
  const recovered = ethers.verifyMessage(message, signature);
  if (recovered.toLowerCase() !== addrNormal) {
    throw new Error("Bad signature");
  }

  // Invalida il nonce dopo l'uso (Replay Protection)
  nonces.delete(addrNormal);

  const role = determineRole(addrNormal);

  // Payload conforme a slide pag. 19: usa 'account'
  const token = signJwt({ 
    account: addrNormal, 
    role: role 
  });

  return { success: true, token, role };
};