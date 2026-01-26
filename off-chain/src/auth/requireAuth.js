import { verifyAccessJwt } from "./jwt.js";

export function requireAuth(req, res, next) {
  const token = req.cookies?.access_token;
  if (!token) return res.status(401).json({ success: false, error: "Missing access token" });

  try {
    const payload = verifyAccessJwt(token);
    const address = payload?.sub;
    if (!address) return res.status(401).json({ success: false, error: "Invalid token payload" });

    req.user = { address };
    return next();
  } catch {
    return res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}
