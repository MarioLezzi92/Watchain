import crypto from "crypto";
import jwt from "jsonwebtoken";
import { ethers } from "ethers";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// nonce DB in RAM (address -> { nonce, exp })
const nonces = new Map();
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minuti

function normalizeAddress(addr) {
  return ethers.getAddress(addr); // checksum + valida
}

function makeNonce() {
  return crypto.randomBytes(16).toString("hex");
}

function roleFromAddress(addr) {
  const a = String(addr || "").toLowerCase();

  const producer = String(process.env.PRODUCER_ADDR || "").toLowerCase();
  const reseller = String(process.env.RESELLER_ADDR || "").toLowerCase();
  const consumer = String(process.env.CONSUMER_ADDR || "").toLowerCase();

  if (producer && a === producer) return "producer";
  if (reseller && a === reseller) return "reseller";
  if (consumer && a === consumer) return "consumer";

  return null;
}

// GET /auth/nonce?address=0x...
export async function getNonce(req, res) {
  try {
    const address = normalizeAddress(req.query.address);
    const nonce = makeNonce();
    const exp = Date.now() + NONCE_TTL_MS;

    nonces.set(address, { nonce, exp });
    return res.json({ nonce });
  } catch {
    return res.status(400).json({ error: "invalid address" });
  }
}

// POST /auth/login { address, signature }
export async function login(req, res) {
  try {
    const { address: rawAddress, signature } = req.body || {};
    if (!rawAddress || !signature) {
      return res.status(400).json({ error: "missing address or signature" });
    }

    const address = normalizeAddress(rawAddress);

    const entry = nonces.get(address);
    if (!entry) return res.status(401).json({ error: "nonce not found" });
    if (Date.now() > entry.exp) {
      nonces.delete(address);
      return res.status(401).json({ error: "nonce expired" });
    }

    const message = `Login to WatchDApp\nNonce: ${entry.nonce}`;

    // verifica firma
    const recovered = normalizeAddress(ethers.verifyMessage(message, signature));
    if (recovered !== address) {
      return res.status(401).json({ error: "bad signature" });
    }

    // brucia nonce
    nonces.delete(address);

    // role deciso dal backend (whitelist)
    const role = roleFromAddress(address);
    if (!role) {
      return res.status(403).json({ error: "address not authorized for any role" });
    }

    const token = jwt.sign({ sub: address, role }, JWT_SECRET, { expiresIn: "2h" });
    return res.json({ token, role });
  } catch {
    return res.status(401).json({ error: "login failed" });
  }
}

// middleware auth: Authorization: Bearer <token>
export function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const [type, token] = auth.split(" ");

    if (type !== "Bearer" || !token) {
      return res.status(401).json({ error: "missing token" });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { sub, role, iat, exp }
    return next();
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }
}
