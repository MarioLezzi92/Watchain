// backend/src/market.js
import axios from "axios";
import { ffInvoke } from "./firefly.js";

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function getBase(role) {
  const r = normalizeRole(role);
  const base = {
    producer: process.env.FF_PRODUCER_BASE,
    reseller: process.env.FF_RESELLER_BASE,
    consumer: process.env.FF_CONSUMER_BASE,
  }[r];

  if (!base) throw new Error(`Unknown role '${role}'`);
  return base.replace(/\/+$/, "");
}

function saleTypeToString(v) {
  // Solidity enum: 0=PRIMARY, 1=SECONDARY
  const n = typeof v === "string" ? Number(v) : v;
  if (n === 0) return "PRIMARY";
  if (n === 1) return "SECONDARY";
  return String(v ?? "UNKNOWN");
}

export async function getActiveListings() {
  const marketRole = normalizeRole(process.env.FF_MARKET_ROLE || "reseller");
  const base = getBase(marketRole);

  const res = await axios.get(`${base}/events`, { params: { limit: 500 } });
  const events = res.data;

  const listings = {};

  for (const ev of events) {
    if (!ev?.event) continue;
    // L'interfaccia è il nome del contract (non l'API), di solito "WatchMarket"
    if (ev.event.interface !== "WatchMarket") continue;

    const name = ev.event.name;
    const data = ev.event.data || {};

    if (name === "Listed") {
      const { tokenId, seller, price, saleType } = data;
      if (tokenId == null) continue;

      listings[String(tokenId)] = {
        tokenId: String(tokenId),
        seller: String(seller ?? ""),
        price: String(price ?? ""),
        saleType: saleTypeToString(saleType),
      };
    }

    if (name === "Purchased") {
      const { tokenId } = data;
      if (tokenId == null) continue;
      delete listings[String(tokenId)];
    }
  }

  return Object.values(listings);
}

// ---- Invoke helpers (nuovo market) ----

const MARKET_API = "WatchMarket_API";
const NFT_API = "WatchNFT_API";

export async function listPrimary(role, tokenId, price) {
  if (normalizeRole(role) !== "producer") {
    throw new Error("Only producer can list primary");
  }
  return ffInvoke("producer", MARKET_API, "listPrimary", {
    tokenId: String(tokenId),
    price: String(price),
  });
}

export async function listSecondary(role, tokenId, price) {
  if (normalizeRole(role) !== "reseller") {
    throw new Error("Only reseller can list secondary");
  }
  return ffInvoke("reseller", MARKET_API, "listSecondary", {
    tokenId: String(tokenId),
    price: String(price),
  });
}

export async function buy(role, tokenId) {
  // reseller compra PRIMARY, consumer compra SECONDARY
  const r = normalizeRole(role);
  if (r !== "reseller" && r !== "consumer") {
    throw new Error("Only reseller/consumer can buy");
  }
  return ffInvoke(r, MARKET_API, "buy", {
    tokenId: String(tokenId),
  });
}

export async function certify(role, tokenId) {
  if (normalizeRole(role) !== "reseller") {
    throw new Error("Only reseller can certify");
  }
  return ffInvoke("reseller", NFT_API, "certify", {
    tokenId: String(tokenId),
  });
}
