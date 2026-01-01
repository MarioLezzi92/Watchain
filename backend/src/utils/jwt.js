// src/utils/jwt.js
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";

/**
 * Genera un nuovo token JWT.
 * @param {Object} payload - Dati da inserire nel token (es. { sub, role })
 * @param {string} expiresIn - Durata (es. "2h", "8h")
 */
export function signJwt(payload, expiresIn = "2h") {
  if (!config.jwtSecret) throw new Error("JWT_SECRET missing in config");
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

/**
 * Verifica un token JWT.
 * Restituisce il payload decodificato o lancia un errore.
 */
export function verifyJwt(token) {
  if (!config.jwtSecret) throw new Error("JWT_SECRET missing in config");
  return jwt.verify(token, config.jwtSecret);
}

/**
 * Decodifica il token senza verificarne la firma (utile solo per debug/client).
 */
export function decodeJwt(token) {
  return jwt.decode(token);
}