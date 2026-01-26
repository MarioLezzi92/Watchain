import jwt from "jsonwebtoken";
import { env } from "../../env.js";

const ACCESS_TTL = env.ACCESS_TTL || "15m";
const REFRESH_TTL = env.REFRESH_TTL || "14d";

export function signAccessJwt(address) {
  return jwt.sign({ sub: address }, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: ACCESS_TTL,
  });
}

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
