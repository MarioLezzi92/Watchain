// backend/src/jwt.js
import jwt from "jsonwebtoken";

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export function signJwt(payload) {
  return jwt.sign(payload, mustEnv("JWT_SECRET"), { expiresIn: "8h" });
}

export function requireAuth(req, res, next) {
  const h = String(req.headers.authorization || "");
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";

  if (!token) return res.status(401).json({ error: "missing token" });

  try {
    req.user = jwt.verify(token, mustEnv("JWT_SECRET"));
    next();
  } catch (e) {
    res.status(401).json({ error: "invalid token" });
  }
}