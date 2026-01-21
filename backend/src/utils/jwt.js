import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function signJwt(payload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: env.JWT_TTL,
  });
}

export function verifyJwt(token) {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"],
  });
}
