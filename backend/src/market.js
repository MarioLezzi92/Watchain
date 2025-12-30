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
    // fallback per ABI vecchie
    const r2 = await ffQuery("reseller", MARKET_API, "listings", { tokenId: t });
    return parseListingStruct(unwrapFFOutput(r2));
  }
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function roleAddrEnv(role) {
  const r = normalizeRole(role);
  const key = `${r.toUpperCase()}_ADDR`;
  const addr = String(process.env[key] || "").trim();
  if (!isAddress(addr)) throw new Error(`${key} mancante o non valido nel backend .env`);
  return addr;
}

// ----------------- funding helpers (optional) -----------------

// trasferimento ERC20: producer -> to
export async function transferLux(role, to, amountWei) {
  const r = normalizeRole(role);
  if (r !== "producer") throw new Error("Only producer can transfer LUX");

  const addr = String(to || "").trim();
  if (!isAddress(addr)) throw new Error("transferLux: address destinatario non valido");

  const value = String(amountWei ?? "").trim();
  if (!/^\d+$/.test(value)) throw new Error("transferLux: amountWei deve essere numeric string (wei)");

  return ffInvoke("producer", LUX_API, "transfer", { to: addr, value });
}

// manda X LUX a producer/reseller/consumer da .env (useful in demo)
export async function fundWhitelist(role, amountLux = 100) {
  const r = normalizeRole(role);
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

// ----------------- security by default: enable market (ERC721 approvalForAll) -----------------
async function ensureMarketEnabled(role) {
  const r = normalizeRole(role);
  if (r !== "producer" && r !== "reseller") return;

  const owner = roleAddrEnv(r);
  const market = resolveWatchMarketAddress();

  const res = await ffQuery(r, NFT_API, "isApprovedForAll", {
    owner,
    operator: market,
  });

  const enabled = Boolean(unwrapFFOutput(res));
  if (!enabled) {
    await ffInvoke(r, NFT_API, "setApprovalForAll", {
      operator: market,
      approved: true,
    });
  }
}

// ----------------- ERC20 approve safe (allowance reset) -----------------
async function getLuxAllowance(role, owner, spender) {
  const res = await ffQuery(role, LUX_API, "allowance", {
    owner: String(owner),
    spender: String(spender),
  });
  return String(unwrapFFOutput(res) ?? "0");
}

export async function approveLux(role, owner, amountWei) {
  const r = normalizeRole(role);
  if (r !== "reseller" && r !== "consumer") {
    throw new Error("Only reseller/consumer can approve");
  }

  const spender = resolveWatchMarketAddress();
  const value = String(amountWei ?? "").trim();
  if (!/^\d+$/.test(value)) {
    throw new Error("approveLux: amountWei deve essere numeric string (wei)");
  }

  const current = await getLuxAllowance(r, owner, spender);

  // 🔐 allowance reset pattern (0 -> value)
  if (current !== "0") {
    await ffInvoke(r, LUX_API, "approve", { spender, value: "0" });
  }

  return ffInvoke(r, LUX_API, "approve", { spender, value });
}

// ----------------- public (used by routes) -----------------
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
    } catch {
      // ignore
    }
  }
  return listings;
}

export async function listPrimary(role, tokenId, price) {
  if (normalizeRole(role) !== "producer") {
    throw new Error("Only producer can list primary");
  }

  // ✅ Enable Market once (setApprovalForAll)
  await ensureMarketEnabled("producer");

  return ffInvoke("producer", MARKET_API, "listPrimary", {
    tokenId: String(tokenId),
    price: String(price),
  });
}

export async function listSecondary(role, tokenId, price) {
  if (normalizeRole(role) !== "reseller") {
    throw new Error("Only reseller can list secondary");
  }

  // ✅ Enable Market once (setApprovalForAll)
  await ensureMarketEnabled("reseller");

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

export async function buy(role, tokenId) {
  const r = normalizeRole(role);
  if (r !== "reseller" && r !== "consumer") {
    throw new Error("Only reseller/consumer can buy");
  }

  const l = await readListing(tokenId);
  if (!l?.exists) {
    throw new Error(`Listing non attivo per tokenId ${tokenId}`);
  }

  // ✅ Approve ERC20 sicuro (0 -> amount)
  const owner = roleAddrEnv(r);
  await approveLux(r, owner, l.price);

  return ffInvoke(r, MARKET_API, "buy", { tokenId: String(tokenId) });
}

export async function withdraw(role) {
  const r = normalizeRole(role);
  if (r !== "producer" && r !== "reseller") {
    throw new Error("Only producer/reseller can withdraw credits");
  }
  return ffInvoke(r, MARKET_API, "withdraw", {});
}

export async function mintNft(to) {
  const recipient = String(to || "").trim();

  const fallbackTo = String(process.env.PRODUCER_ADDR || "").trim();
  const finalTo = recipient || fallbackTo;

  if (!isAddress(finalTo)) {
    throw new Error("mintNft: missing/invalid 'to' address (and PRODUCER_ADDR not set)");
  }

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

// onlyOwner whenPaused
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
