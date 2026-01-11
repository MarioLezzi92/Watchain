import jwt from "jsonwebtoken";
import { config } from "../config/env.js";

/**
 * Genera un Token JWT firmato (Sign).
 * @param {Object} payload - Dati da inserire nel token (indirizzo wallet, ruolo).
 * @param {string} expiresIn - Durata del token (default: 1 ora).
 */
export function signJwt(payload, expiresIn = "1h") {
  if (!config.jwtSecret) throw new Error("JWT_SECRET missing in config");
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

/**
 * Verifica se un token è valido e originale.
 * Lancia un'eccezione se il token è scaduto o manomesso.
 */
export function verifyJwt(token) {
  if (!config.jwtSecret) throw new Error("JWT_SECRET missing in config");
  return jwt.verify(token, config.jwtSecret);
}

/**
 * Decodifica il token senza verificarne la firma 
 */
export function decodeJwt(token) {
  return jwt.decode(token);
}