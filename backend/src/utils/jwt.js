import jwt from "jsonwebtoken";
import { config } from "../config/env.js";

/**
 * Genera un nuovo token JWT 
 * @param {Object} payload - Dati da inserire (es. { account: "0x...", role: "producer" })
 * @param {string} expiresIn - Durata (es. "1h")
 */
export function signJwt(payload, expiresIn = "1h") {
  if (!config.jwtSecret) throw new Error("JWT_SECRET missing in config");
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

/**
 * Verifica un token JWT.
 */
export function verifyJwt(token) {
  if (!config.jwtSecret) throw new Error("JWT_SECRET missing in config");
  return jwt.verify(token, config.jwtSecret);
}

/**
 * Decodifica il token senza verificarne la firma (utile per il frontend).
 */
export function decodeJwt(token) {
  return jwt.decode(token);
}