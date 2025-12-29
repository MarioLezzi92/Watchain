import { ffQuery } from "./firefly.js";

function lc(x) {
  return String(x || "").toLowerCase().trim();
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

function parseBool(v) {
  if (typeof v === "boolean") return v;
  const s = String(v || "").trim().toLowerCase();
  return s === "true" || s === "1";
}

async function ffQueryWithFallback(role, apiName, method, tokenId) {
  const t = String(tokenId);

  // 1) forma classica { tokenId }
  try {
    return await ffQuery(role, apiName, method, { tokenId: t });
  } catch (e1) {
    // 2) forma anonima { "": tokenId }
    try {
      return await ffQuery(role, apiName, method, { "": t });
    } catch (e2) {
      // 3) forma posizionale { "0": tokenId }
      return await ffQuery(role, apiName, method, { "0": t });
    }
  }
}

export async function buildInventory(role, address) {
  const addr = lc(address);
  const items = [];

  const nextIdRes = await ffQuery(role, "WatchNFT_API", "nextId", {});
  const nextId = Number(unwrapFFOutput(nextIdRes) || 0);

  // tokenId 0 non esiste -> parti da 1
  for (let i = 1; i <= nextId; i++) {
    try {
      const ownerRes = await ffQueryWithFallback(role, "WatchNFT_API", "ownerOf", i);
      const certRes = await ffQueryWithFallback(role, "WatchNFT_API", "certified", i);

      const owner = lc(unwrapFFOutput(ownerRes) || "");
      const certified = parseBool(unwrapFFOutput(certRes));

      if (owner !== addr) continue;

      items.push({
        tokenId: String(i),
        owner,
        certified,
      });
    } catch {
      // token non esistente o revert: lo saltiamo
    }
  }

  return items;
}
