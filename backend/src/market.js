// backend/src/market.js
import { ffQuery, ffInvoke } from "./firefly.js";

const MARKET_API = "WatchMarket_API";
const NFT_API = "WatchNFT_API";
const COIN_API = "LuxuryCoin_API";

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

  // struct o tuple-like
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

export async function getActiveListings() {
  // nextId dal WatchNFT: token esistenti 1..nextId
  const nextIdRes = await ffQuery("producer", NFT_API, "nextId", {});
  const nextId = Number(unwrapFFOutput(nextIdRes) || 0);

  const listings = [];

  for (let tokenId = 1; tokenId <= nextId; tokenId++) {
    let listingResp = null;

    // prova getListing(tokenId)
    try {
      listingResp = await ffQuery("reseller", MARKET_API, "getListing", { tokenId: String(tokenId) });
    } catch {
      // fallback: getter mapping public listings(tokenId)
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

export async function listPrimary(role, tokenId, price) {
  if (String(role).toLowerCase() !== "producer") throw new Error("Only producer can list primary");
  return ffInvoke("producer", MARKET_API, "listPrimary", {
    tokenId: String(tokenId),
    price: String(price),
  });
}

export async function listSecondary(role, tokenId, price) {
  if (String(role).toLowerCase() !== "reseller") throw new Error("Only reseller can list secondary");
  return ffInvoke("reseller", MARKET_API, "listSecondary", {
    tokenId: String(tokenId),
    price: String(price),
  });
}

export async function buy(role, tokenId) {
  const r = String(role).toLowerCase();
  if (r !== "reseller" && r !== "consumer") throw new Error("Only reseller/consumer can buy");
  return ffInvoke(r, MARKET_API, "buy", { tokenId: String(tokenId) });
}

export async function certify(role, tokenId) {
  if (String(role).toLowerCase() !== "reseller") throw new Error("Only reseller can certify");
  return ffInvoke("reseller", NFT_API, "certify", { tokenId: String(tokenId) });
}


export async function approveLux(role, spender, amount) {
  const r = String(role || "").toLowerCase();

  if (r !== "reseller" && r !== "consumer") {
    throw new Error("Only reseller/consumer can approve");
  }
  const s = String(spender || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(s)) {
    throw new Error(
      `Invalid spender address: '${spender}'. Expected 0x + 40 hex chars.`
    );
  }

  const v = String(amount ?? "").trim();
  if (!/^\d+$/.test(v)) {
    throw new Error(
      `Invalid approve value: '${amount}'. Expected uint256 (numeric string).`
    );
  }

  return ffInvoke(r, "LuxuryCoin_API", "approve", {
    spender: s,     // address (160 bit)
    value: v,       // uint256
  });
}

