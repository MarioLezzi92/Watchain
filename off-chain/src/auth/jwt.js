// jwt.js
import jwt from "jsonwebtoken";
import { env } from "../../env.js";

const ISSUER = env.JWT_ISSUER || "watchain-backend";
const AUDIENCE = env.JWT_AUDIENCE || "watchain-frontend";

export function signJwt(payload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: env.JWT_TTL,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

export function verifyJwt(token) {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}
