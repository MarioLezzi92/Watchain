// backend/src/market.js
import { ffQuery, ffInvoke } from "./firefly.js";

const MARKET_API = "WatchMarket_API";
const NFT_API = "WatchNFT_API";
const LUX_API = "LuxuryCoin_API";

// ----------------- helpers -----------------
function lc(x) {
  return String(x || "").trim().toLowerCase();
}

function isAddress(a) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(a || "").trim());
}

function toWei18FromLuxInt(luxInt) {
  const n = String(luxInt ?? "").trim();
  if (!/^\d+$/.test(n)) throw new Error("amountLux deve essere un intero (es. 100)");
  return `${n}000000000000000000`;
}

function resolveWatchMarketAddress() {
  const a =
    process.env.WATCHMARKET_ADDRESS ||
    process.env.WATCHMARKET_ADDR ||
    process.env.WATCHMARKET_CONTRACT ||
    "";

  const addr = String(a).trim();
  if (!isAddress(addr)) {
    throw new Error("WATCHMARKET_ADDRESS mancante o non valido nel backend .env");
  }
  return addr;
}

export async function approveNftForMarket(role, tokenId) {
  const r = String(role || "").toLowerCase();
  if (r !== "producer" && r !== "reseller") {
    throw new Error("Only producer/reseller can approve NFT");
  }

  const market = resolveWatchMarketAddress(); // usa WATCHMARKET_ADDRESS
  return ffInvoke(r, NFT_API, "approve", {
    to: market,
    tokenId: String(tokenId),
  });
}

// trasferimento ERC20: producer -> to
export async function transferLux(role, to, amountWei) {
  const r = String(role || "").toLowerCase();
  if (r !== "producer") throw new Error("Only producer can transfer LUX");

  if (!isAddress(to)) throw new Error("transferLux: address destinatario non valido");
  const value = String(amountWei ?? "").trim();
  if (!/^\d+$/.test(value)) throw new Error("transferLux: amountWei deve essere numeric string (wei)");

  // ERC20.transfer(to,value)
  return ffInvoke("producer", LUX_API, "transfer", { to: String(to), value });
}


// manda 100 LUX (default) a tutti gli account della whitelist letta da env
export async function fundWhitelist(role, amountLux = 100) {
  const r = String(role || "").toLowerCase();
  if (r !== "producer") throw new Error("Only producer can fund whitelist");

  const amount = String(amountLux ?? "").trim();
  if (!/^\d+$/.test(amount)) throw new Error("amountLux deve essere un intero (es. 100)");
  const valueWei = `${amount}000000000000000000`;

  const list = [
    String(process.env.PRODUCER_ADDR || "").trim(),
    String(process.env.RESELLER_ADDR || "").trim(),
    String(process.env.CONSUMER_ADDR || "").trim(),
  ].filter(Boolean);

  if (list.length === 0) {
    throw new Error("Whitelist vuota: imposta PRODUCER_ADDR, RESELLER_ADDR, CONSUMER_ADDR nel backend .env");
  }

  const seen = new Set();
  const dedup = [];
  for (const addr of list) {
    const low = addr.toLowerCase();
    if (seen.has(low)) continue;
    seen.add(low);
    dedup.push(addr);
  }

  const bad = dedup.filter((a) => !isAddress(a));
  if (bad.length) throw new Error(`Whitelist contiene address non validi: ${bad.join(", ")}`);

  const results = [];
  for (const addr of dedup) {
    const tx = await transferLux("producer", addr, valueWei);
    results.push({ to: addr, amountLux: Number(amount), tx });
  }

  return results;
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

function parseEnvAddressList(key) {
  const raw = String(process.env[key] || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseBool(v) {
  if (typeof v === "boolean") return v;
  const s = String(v || "").trim().toLowerCase();
  return s === "true" || s === "1";
}

function parseListingStruct(raw) {
  if (!raw) return null;

  // struct Listing { address seller; uint256 price; SaleType saleType; bool exists; }
  const seller = raw.seller ?? raw["0"];
  const price = raw.price ?? raw["1"];
  const saleType = raw.saleType ?? raw["2"];
  const exists = raw.exists ?? raw["3"];

  return {
    seller: seller != null ? String(seller) : "",
    price: price != null ? String(price) : "",
    saleType: normalizeSaleType(saleType),
    exists: parseBool(exists),
  };
}

async function readListing(tokenId) {
  const t = String(tokenId);

  // prefer getListing (nuovo)
  try {
    const r = await ffQuery("reseller", MARKET_API, "getListing", { tokenId: t });
    return parseListingStruct(unwrapFFOutput(r));
  } catch {
    // fallback per ABI vecchie (se presenti)
    const r2 = await ffQuery("reseller", MARKET_API, "listings", { tokenId: t });
    return parseListingStruct(unwrapFFOutput(r2));
  }
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

// ----------------- public (used by routes) -----------------
export async function getActiveListings() {
  // WatchNFT.nextId = ultimo token mintato
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
    } catch {
      // ignore missing token / revert
    }
  }

  return listings;
}

export async function listPrimary(role, tokenId, price) {
  if (normalizeRole(role) !== "producer") {
    throw new Error("Only producer can list primary");
  }

  await approveNftForMarket("producer", tokenId);

  return ffInvoke("producer", MARKET_API, "listPrimary", {
    tokenId: String(tokenId),
    price: String(price),
  });
}


export async function listSecondary(role, tokenId, price) {
  if (normalizeRole(role) !== "reseller") {
    throw new Error("Only reseller can list secondary");
  }

  // ✅ fondamentale: il Market deve essere approvato a trasferire l'NFT del reseller
  await approveNftForMarket("reseller", tokenId);

  return ffInvoke("reseller", MARKET_API, "listSecondary", {
    tokenId: String(tokenId),
    price: String(price),
  });
}


export async function cancelListing(role, tokenId) {
  const r = normalizeRole(role);
  if (r !== "producer" && r !== "reseller") {
    throw new Error("Only producer/reseller can cancel listings");
  }
  return ffInvoke(r, MARKET_API, "cancelListing", { tokenId: String(tokenId) });
}

export async function certify(role, tokenId) {
  if (normalizeRole(role) !== "reseller") {
    throw new Error("Only reseller can certify");
  }
  return ffInvoke("reseller", NFT_API, "certify", { tokenId: String(tokenId) });
}

export async function approveLux(role, amountWei) {
  const r = normalizeRole(role);
  if (r !== "reseller" && r !== "consumer") {
    throw new Error("Only reseller/consumer can approve");
  }

  const spender = resolveWatchMarketAddress();
  const value = String(amountWei ?? "").trim();
  if (!/^\d+$/.test(value)) {
    throw new Error("approveLux: amountWei deve essere numeric string (wei)");
  }

  return ffInvoke(r, LUX_API, "approve", { spender, value });
}

export async function buy(role, tokenId) {
  const r = normalizeRole(role);
  if (r !== "reseller" && r !== "consumer") {
    throw new Error("Only reseller/consumer can buy");
  }

  const l = await readListing(tokenId);
  if (!l?.exists) {
    throw new Error(`Listing non attivo per tokenId ${tokenId}`);
  }

  // PullPayments: serve allowance per spendere LUX, quindi approve prima del buy
  await approveLux(r, l.price);

  return ffInvoke(r, MARKET_API, "buy", { tokenId: String(tokenId) });
}

export async function withdraw(role) {
  const r = normalizeRole(role);
  if (r !== "producer" && r !== "reseller") {
    throw new Error("Only producer/reseller can withdraw credits");
  }
  // PullPayments: revert "no credit" se non hai nulla da incassare
  return ffInvoke(r, MARKET_API, "withdraw", {});
}

export async function mintNft(to) {
  const recipient = String(to || "").trim();

  // se "to" non è passato, mintiamo direttamente al producer address whitelisted
  const fallbackTo = String(process.env.PRODUCER_ADDR || "").trim();
  const finalTo = recipient || fallbackTo;

  if (!isAddress(finalTo)) {
    throw new Error("mintNft: missing/invalid 'to' address (and PRODUCER_ADDR not set)");
  }

  // WatchNFT: la funzione è manufacture(to)
  return ffInvoke("producer", NFT_API, "manufacture", { to: finalTo });
}

// ----------------- admin/owner ops (EmergencyStop + whitelist) -----------------
export async function pauseNft(role) {
  if (normalizeRole(role) !== "producer") throw new Error("Only producer (owner) can pause NFT");
  return ffInvoke("producer", NFT_API, "pause", {});
}

export async function unpauseNft(role) {
  if (normalizeRole(role) !== "producer") throw new Error("Only producer (owner) can unpause NFT");
  return ffInvoke("producer", NFT_API, "unpause", {});
}

export async function pauseMarket(role) {
  if (normalizeRole(role) !== "producer") throw new Error("Only producer (owner) can pause Market");
  return ffInvoke("producer", MARKET_API, "pause", {});
}

export async function unpauseMarket(role) {
  if (normalizeRole(role) !== "producer") throw new Error("Only producer (owner) can unpause Market");
  return ffInvoke("producer", MARKET_API, "unpause", {});
}

export async function setReseller(role, who, enabled) {
  if (normalizeRole(role) !== "producer") throw new Error("Only producer (owner) can set reseller");
  const addr = String(who || "").trim();
  if (!isAddress(addr)) throw new Error("setReseller: address non valido");

  return ffInvoke("producer", NFT_API, "setReseller", {
    who: addr,
    enabled: Boolean(enabled),
  });
}

// opzionali (soloOwner whenPaused) — utili se “freezi” e recuperi fondi bloccati
export async function recoverERC20(role, token, to, amount) {
  if (normalizeRole(role) !== "producer") throw new Error("Only producer (owner) can recover");
  if (!isAddress(token) || !isAddress(to)) throw new Error("recoverERC20: token/to non validi");
  if (!/^\d+$/.test(String(amount))) throw new Error("recoverERC20: amount deve essere wei string");

  return ffInvoke("producer", MARKET_API, "recoverERC20", {
    token: String(token),
    to: String(to),
    amount: String(amount),
  });
}

export async function recoverETH(role, to, amount) {
  if (normalizeRole(role) !== "producer") throw new Error("Only producer (owner) can recover");
  if (!isAddress(to)) throw new Error("recoverETH: to non valido");
  if (!/^\d+$/.test(String(amount))) throw new Error("recoverETH: amount deve essere wei string");

  return ffInvoke("producer", MARKET_API, "recoverETH", {
    to: String(to),
    amount: String(amount),
  });
}
