import jwt from "jsonwebtoken";
import { config } from "../config/env.js";

/**
 * UTILS: JWT MANAGER
 * Gestione centralizzata della firma e verifica dei token.
 * Security Note: Usiamo esplicitamente HS256 per evitare alg 'none' attacks.
 */

// Genera un Token JWT firmato
export function signJwt(payload, expiresIn = "1h") {
  if (!config.jwtSecret) throw new Error("CRITICAL: JWT_SECRET missing in config");
  
  return jwt.sign(payload, config.jwtSecret, { 
    expiresIn,
    algorithm: "HS256" // Esplicitiamo l'algoritmo per sicurezza
  });
}

// Verifica e decodifica il token
export function verifyJwt(token) {
  if (!config.jwtSecret) throw new Error("CRITICAL: JWT_SECRET missing in config");
  
  return jwt.verify(token, config.jwtSecret, {
    algorithms: ["HS256"] 
  });
}

// Decodifica senza verifica (Solo per debug o lettura lato client)
export function decodeJwt(token) {
  return jwt.decode(token);
}