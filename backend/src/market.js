// backend/src/market.js
import { ffInvoke, ffQuery } from "./firefly.js";

const MARKET_API = "WatchMarket_API";
const NFT_API = "WatchNFT_API";
const COIN_API = "LuxuryCoin_API";

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function unwrapFFOutput(resp) {
  if (!resp) return undefined;
  const out = resp.output ?? resp.result ?? resp.data ?? resp;
  if (out == null) return undefined;

  if (typeof out === "string" || typeof out === "number" || typeof out === "boolean") return out;
  if (Array.isArray(out)) return out[0];

  if (typeof out === "object") {
    if ("0" in out) return out; // tuple/struct
    const keys = Object.keys(out);
    if (keys.length === 1) return out[keys[0]];
    return out;
  }

  return undefined;
}

function normalizeSaleType(v) {
  if (typeof v === "number") return v === 0 ? "PRIMARY" : "SECONDARY";
  const s = String(v || "").toUpperCase();
  if (s.includes("PRIMARY")) return "PRIMARY";
  if (s.includes("SECONDARY")) return "SECONDARY";
  if (s === "0") return "PRIMARY";
  if (s === "1") return "SECONDARY";
  return s || "UNKNOWN";
}

function parseListingStruct(raw) {
  if (!raw) return null;
  const seller = raw.seller ?? raw["0"];
  const price = raw.price ?? raw["1"];
  const saleType = raw.saleType ?? raw["2"];
  const exists = raw.exists ?? raw["3"];

  return {
    seller: seller != null ? String(seller) : "",
    price: price != null ? String(price) : "",
    saleType: normalizeSaleType(saleType),
    exists: Boolean(exists),
  };
}

// -------------------- LISTINGS (state-based, no events) --------------------
export async function getActiveListings() {
  const nextIdRes = await ffQuery("producer", NFT_API, "nextId", {});
  const nextId = Number(unwrapFFOutput(nextIdRes) || 0);

  const listings = [];

  for (let tokenId = 1; tokenId <= nextId; tokenId++) {
    let listingResp = null;

    try {
      listingResp = await ffQuery("reseller", MARKET_API, "getListing", { tokenId: String(tokenId) });
    } catch {
      try {
        listingResp = await ffQuery("reseller", MARKET_API, "listings", { tokenId: String(tokenId) });
      } catch {
        continue;
      }
    }

    const raw = unwrapFFOutput(listingResp);
    const parsed = parseListingStruct(raw);

    if (parsed?.exists) {
      listings.push({
        tokenId: String(tokenId),
        seller: parsed.seller,
        price: parsed.price,
        saleType: parsed.saleType,
      });
    }
  }

  return listings;
}

// -------------------- MARKET ACTIONS --------------------
export async function listPrimary(role, tokenId, price) {
  if (normalizeRole(role) !== "producer") throw new Error("Only producer can list primary");
  return ffInvoke("producer", MARKET_API, "listPrimary", {
    tokenId: String(tokenId),
    price: String(price),
  });
}

export async function listSecondary(role, tokenId, price) {
  if (normalizeRole(role) !== "reseller") throw new Error("Only reseller can list secondary");
  return ffInvoke("reseller", MARKET_API, "listSecondary", {
    tokenId: String(tokenId),
    price: String(price),
  });
}

export async function buy(role, tokenId) {
  const r = normalizeRole(role);
  if (r !== "reseller" && r !== "consumer") throw new Error("Only reseller/consumer can buy");
  return ffInvoke(r, MARKET_API, "buy", { tokenId: String(tokenId) });
}

export async function certify(role, tokenId) {
  if (normalizeRole(role) !== "reseller") throw new Error("Only reseller can certify");
  return ffInvoke("reseller", NFT_API, "certify", { tokenId: String(tokenId) });
}

// -------------------- COIN HELPERS --------------------
function validateAddress(addr, label = "address") {
  const s = String(addr || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(s)) {
    throw new Error(`Invalid ${label}: '${addr}'. Expected 0x + 40 hex chars.`);
  }
  return s;
}

function validateUint(v, label = "value") {
  const s = String(v ?? "").trim();
  if (!/^\d+$/.test(s)) {
    throw new Error(`Invalid ${label}: '${v}'. Expected numeric string uint256.`);
  }
  return s;
}

export async function approveLux(role, spender, amount) {
  const r = normalizeRole(role);
  if (r !== "reseller" && r !== "consumer") {
    throw new Error("Only reseller/consumer can approve");
  }

  const s = validateAddress(spender, "spender");
  const value = validateUint(amount, "amount");

  // ERC20 approve(address spender, uint256 value)
  return ffInvoke(r, COIN_API, "approve", {
    spender: s,
    value: value,
  });
}

export async function approveLuxMax(role, spender) {
  const r = normalizeRole(role);
  if (r !== "reseller" && r !== "consumer") {
    throw new Error("Only reseller/consumer can approve");
  }

  const s = validateAddress(spender, "spender");

  // uint256 max = 2^256 - 1
  const MAX =
    "115792089237316195423570985008687907853269984665640564039457584007913129639935";

  return ffInvoke(r, COIN_API, "approve", {
    spender: s,
    value: MAX,
  });
}

export async function coinBalance(role, account) {
  const r = normalizeRole(role);
  if (r !== "producer" && r !== "reseller" && r !== "consumer") {
    throw new Error("Invalid role");
  }
  const a = validateAddress(account, "account");
  // ERC20 balanceOf(address account)
  const res = await ffQuery(r, COIN_API, "balanceOf", { account: a });
  return String(unwrapFFOutput(res) ?? "0");
}

export async function coinAllowance(role, owner, spender) {
  const r = normalizeRole(role);
  if (r !== "producer" && r !== "reseller" && r !== "consumer") {
    throw new Error("Invalid role");
  }
  const o = validateAddress(owner, "owner");
  const s = validateAddress(spender, "spender");
  // ERC20 allowance(address owner, address spender)
  const res = await ffQuery(r, COIN_API, "allowance", { owner: o, spender: s });
  return String(unwrapFFOutput(res) ?? "0");
}
