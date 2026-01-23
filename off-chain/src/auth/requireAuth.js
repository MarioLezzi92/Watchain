import { verifyJwt } from "./jwt.js";

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);

  if (!m) {
    return res.status(401).json({ success: false, error: "Missing Bearer token" });
  }

  try {
    const payload = verifyJwt(m[1]);
    const address = payload?.sub || payload?.account;

    if (!address) {
      return res.status(401).json({ success: false, error: "Invalid token payload" });
    }

    req.user = { address: String(address).toLowerCase() };
    return next();
  } catch {
    return res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}
