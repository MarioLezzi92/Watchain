import jwt from "jsonwebtoken";
import { env } from "../../env.js";

// TTL definiti nell'env.js (Default: 15 min access, 14 giorni refresh)
const ACCESS_TTL = env.ACCESS_TTL || "15m";
const REFRESH_TTL = env.REFRESH_TTL || "14d";

/**
 * Firma Access Token (Stateless).
 * Contiene solo il subject (address). Usato per l'accesso alle risorse.
 */
export function signAccessJwt(address) {
  return jwt.sign({ sub: address }, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: ACCESS_TTL,
  });
}

/**
 * Firma Refresh Token (Stateful via JTI).
 * Include 'jti' (JWT ID) per implementare la token rotation e la revoca.
 */
export function signRefreshJwt(address, jti) {
  return jwt.sign({ sub: address, jti }, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: REFRESH_TTL,
  });
}

export function verifyAccessJwt(token) {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
}

export function verifyRefreshJwt(token) {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
}
