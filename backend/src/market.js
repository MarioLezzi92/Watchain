import axios from "axios";

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

export async function getActiveListings() {
  const marketRole = normalizeRole(process.env.FF_MARKET_ROLE || "reseller");
  const base = getBase(marketRole);

  const res = await axios.get(`${base}/events`, { params: { limit: 200 } });
  const events = res.data;

  const listings = {};
  for (const ev of events) {
    if (!ev?.event) continue;
    if (ev.event.interface !== "WatchMarket") continue;

    const name = ev.event.name;
    const data = ev.event.data;

    if (name === "Listed") {
      const { tokenId, seller, price, requireCertified } = data;
      listings[tokenId] = { tokenId, seller, price, requireCertified };
    }

    if (name === "Unlisted" || name === "Sold") {
      const { tokenId } = data;
      delete listings[tokenId];
    }
  }

  return Object.values(listings);
}
