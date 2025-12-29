// backend/src/market.js
import { ffQuery, ffInvoke } from "./firefly.js";

const MARKET_API = "WatchMarket_API";
const NFT_API = "WatchNFT_API";
const LUX_API = "LuxuryCoin_API";

// accetta più nomi per evitare mismatch
function resolveWatchMarketAddress() {
  const a =
    process.env.WATCHMARKET_ADDRESS ||
    process.env.WATCHMARKET_ADDR ||
    process.env.WATCHMARKET_CONTRACT ||
    "";

  const addr = String(a).trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    throw new Error("WATCHMARKET_ADDRESS mancante o non valido nel backend .env");
  }

  return addr;
}

function unwrapFFOutput(resp) {
  if (!resp) return undefined;
  const out = resp.output ?? resp.result ?? resp.data ?? resp;
  if (out == null) return undefined;

  if (typeof out === "string" || typeof out === "number" || typeof out === "boolean") return out;
  if (Array.isArray(out)) return out[0];

  if (typeof out === "object") {
    const keys = Object.keys(out);
    if (keys.length === 1) return out[keys[0]];
    return out;
  }
  return undefined;
}

function normalizeSaleType(v) {
  if (typeof v === "number") return v === 0 ? "PRIMARY" : "SECONDARY";
  const s = String(v || "").toUpperCase();
  if (s === "0") return "PRIMARY";
  if (s === "1") return "SECONDARY";
  if (s.includes("PRIMARY")) return "PRIMARY";
  if (s.includes("SECONDARY")) return "SECONDARY";
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

async function readListing(tokenId) {
  const t = String(tokenId);

  try {
    const r = await ffQuery("reseller", MARKET_API, "getListing", { tokenId: t });
    return parseListingStruct(unwrapFFOutput(r));
  } catch {
    const r2 = await ffQuery("reseller", MARKET_API, "listings", { tokenId: t });
    return parseListingStruct(unwrapFFOutput(r2));
  }
}

export async function getActiveListings() {
  const nextIdRes = await ffQuery("producer", NFT_API, "nextId", {});
  const nextId = Number(unwrapFFOutput(nextIdRes) || 0);

  const listings = [];
  for (let tokenId = 1; tokenId <= nextId; tokenId++) {
    try {
      const l = await readListing(tokenId);
      if (l?.exists) {
        listings.push({
          tokenId: String(tokenId),
          seller: l.seller,
          price: l.price,
          saleType: l.saleType,
        });
      }
    } catch {}
  }

  return listings;
}

export async function listPrimary(role, tokenId, price) {
  if (String(role).toLowerCase() !== "producer") {
    throw new Error("Only producer can list primary");
  }
  return ffInvoke("producer", MARKET_API, "listPrimary", {
    tokenId: String(tokenId),
    price: String(price),
  });
}

export async function listSecondary(role, tokenId, price) {
  if (String(role).toLowerCase() !== "reseller") {
    throw new Error("Only reseller can list secondary");
  }
  return ffInvoke("reseller", MARKET_API, "listSecondary", {
    tokenId: String(tokenId),
    price: String(price),
  });
}

export async function certify(role, tokenId) {
  if (String(role).toLowerCase() !== "reseller") {
    throw new Error("Only reseller can certify");
  }
  return ffInvoke("reseller", NFT_API, "certify", { tokenId: String(tokenId) });
}

export async function approveLux(role, amountWei) {
  const r = String(role || "").toLowerCase();
  if (r !== "reseller" && r !== "consumer") {
    throw new Error("Only reseller/consumer can approve");
  }

  const spender = resolveWatchMarketAddress();
  const value = String(amountWei ?? "").trim();
  if (!/^\d+$/.test(value)) {
    throw new Error("approveLux: amountWei deve essere numeric string (wei)");
  }

  // log utile
  console.log("APPROVE LUX:", { role: r, spender, value });

  return ffInvoke(r, LUX_API, "approve", { spender, value });
}

export async function buy(role, tokenId) {
  const r = String(role || "").toLowerCase();
  if (r !== "reseller" && r !== "consumer") {
    throw new Error("Only reseller/consumer can buy");
  }

  const l = await readListing(tokenId);
  if (!l?.exists) {
    throw new Error(`Listing non attivo per tokenId ${tokenId}`);
  }

  await approveLux(r, l.price);

  return ffInvoke(r, MARKET_API, "buy", { tokenId: String(tokenId) });
}

export async function mintNft(to) {
  const recipient = String(to || "").trim();

  // se "to" non è passato, mintiamo direttamente al producer address whitelisted
  const fallbackTo = String(process.env.PRODUCER_ADDR || "").trim();
  const finalTo = recipient || fallbackTo;

  if (!/^0x[a-fA-F0-9]{40}$/.test(finalTo)) {
    throw new Error("mintNft: missing/invalid 'to' address (and PRODUCER_ADDR not set)");
  }

  return ffInvoke("producer", NFT_API, "manufacture", { to: finalTo });
}
