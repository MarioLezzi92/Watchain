import crypto from "crypto";
import { ethers } from "ethers";
import { env } from "../../env.js";
import { signAccessJwt, signRefreshJwt, verifyRefreshJwt } from "./jwt.js";

const nonces = new Map();

// refresh token store in-memory (per le slide va bene; in prod: DB/redis)
const refreshStore = new Map(); // address -> currentJti

setInterval(() => {
  const now = Date.now();
  for (const [addr, entry] of nonces.entries()) {
    if (now > entry.exp) nonces.delete(addr);
  }
}, 10 * 60 * 1000).unref();

function makeNonce() {
  return crypto.randomBytes(16).toString("hex");
}

function makeJti() {
  return crypto.randomBytes(16).toString("hex");
}

function makeCsrf() {
  return crypto.randomBytes(32).toString("hex");
}

export function generateNonce(address) {
  if (!address) throw new Error("Address mancante");
  const addr = String(address).toLowerCase();
  const nonce = makeNonce();
  nonces.set(addr, { nonce, exp: Date.now() + (env.NONCE_TTL_MS || 600000) });
  return nonce;
}

// login: verifica firma, emette access+refresh, salva jti (rotation-ready)
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

  nonces.delete(addr);

  const jti = makeJti();
  refreshStore.set(addr, jti);

  const accessToken = signAccessJwt(addr);
  const refreshToken = signRefreshJwt(addr, jti);
  const csrfToken = makeCsrf();

  return { address: addr, accessToken, refreshToken, csrfToken };
}

// refresh: verifica refresh cookie + rotation
export function refreshSession(refreshToken) {
  if (!refreshToken) throw new Error("Missing refresh token");

  const payload = verifyRefreshJwt(refreshToken);
  const addr = String(payload?.sub || "").toLowerCase();
  const jti = payload?.jti;

  if (!addr || !jti) throw new Error("Invalid refresh token");
  const current = refreshStore.get(addr);
  if (!current || current !== jti) throw new Error("Refresh token revoked/rotated");

  // rotate
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
