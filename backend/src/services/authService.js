import crypto from "crypto";
import jwt from "jsonwebtoken";
import { ethers } from "ethers"; // Assicurati di avere ethers installato
import { config } from "../config/env.js";
import { normalizeRole } from "../utils/formatters.js";

const nonces = new Map(); // DB in RAM per i nonce
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minuti

function makeNonce() {
  return crypto.randomBytes(16).toString("hex");
}

function determineRole(address) {
  const a = String(address).toLowerCase();
  if (a === String(config.producerAddr).toLowerCase()) return "producer";
  if (a === String(config.resellerAddr).toLowerCase()) return "reseller";
  if (a === String(config.consumerAddr).toLowerCase()) return "consumer";
  return null; // O "viewer" se vuoi un ruolo default
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

  if (!entry) throw new Error("nonce not found");
  if (Date.now() > entry.exp) {
    nonces.delete(addrNormal);
    throw new Error("nonce expired");
  }

  const message = `Login to WatchDApp\nNonce: ${entry.nonce}`;
  
  // Verifica firma con Ethers
  const recovered = ethers.verifyMessage(message, signature);
  if (recovered.toLowerCase() !== addrNormal) {
    throw new Error("bad signature");
  }

  // Brucia il nonce per evitare replay attack
  nonces.delete(addrNormal);

  // Assegna ruolo
  const role = determineRole(addrNormal);
  if (!role) throw new Error("Address not authorized (not in whitelist)");

  // Crea Token
  const token = jwt.sign({ sub: addrNormal, role }, config.jwtSecret, { expiresIn: "2h" });

  return { token, role };
};