// backend/src/auth.js
import crypto from "crypto";
import { ethers } from "ethers";
import { signJwt } from "./jwt.js";

function lc(x) {
  return String(x || "").trim().toLowerCase();
}

function resolveRoleByAddress(address) {
  const a = lc(address);
  if (a && a === lc(process.env.PRODUCER_ADDR)) return "producer";
  if (a && a === lc(process.env.RESELLER_ADDR)) return "reseller";
  if (a && a === lc(process.env.CONSUMER_ADDR)) return "consumer";
  return "consumer";
}

function loginMessage(nonce) {
  return `Login to WatchDApp\nNonce: ${nonce}`;
}

const nonces = new Map(); // addressLower -> { nonce, ts }

export function getNonce(req, res) {
  const address = String(req.query.address || "").trim();
  if (!address) return res.status(400).json({ error: "missing address" });

  const nonce = crypto.randomBytes(16).toString("hex");
  nonces.set(lc(address), { nonce, ts: Date.now() });

  res.json({ nonce });
}

export async function login(req, res) {
  try {
    const { address, signature } = req.body || {};
    if (!address || !signature) {
      return res.status(400).json({ error: "missing address/signature" });
    }

    const rec = nonces.get(lc(address));
    if (!rec?.nonce) {
      return res.status(400).json({ error: "nonce not found (request /auth/nonce first)" });
    }

    const msg = loginMessage(rec.nonce);

    let recovered;
    try {
      recovered = ethers.verifyMessage(msg, signature);
    } catch (e) {
      return res.status(400).json({ error: `invalid signature: ${String(e?.message || e)}` });
    }

    if (lc(recovered) !== lc(address)) {
      return res.status(401).json({ error: "signature does not match address" });
    }

    const role = resolveRoleByAddress(address);

    const payload = {
      address: ethers.getAddress(address),
      role,
    };

    const token = signJwt(payload);

    nonces.delete(lc(address));
    res.json({ token, role });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
