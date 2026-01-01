import jwt from "jsonwebtoken";
import { config } from "../config/env.js";

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Authorization header missing" });
  }

  const token = authHeader.startsWith("Bearer ") 
    ? authHeader.slice(7).trim() 
    : authHeader;

  if (!token) {
    return res.status(401).json({ error: "Token missing" });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = payload; // { sub: address, role: "..." }
    next();
  } catch (err) {
    console.error("Auth Token Error:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};