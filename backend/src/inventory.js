// backend/src/inventory.js
import { ffQuery } from "./firefly.js";
import { tokenArg } from "./ffinput.js";

function lc(x) {
  return String(x || "").toLowerCase();
}

/**
 * FireFly a volte ritorna:
 * - { output: "4" }
 * - { output: 4 }
 * - { output: { "0": "4" } }
 * - { output: { nextId: "4" } }
 * - { output: ["4"] }
 * Questo helper prende "il valore" in modo robusto.
 */
function unwrapFFOutput(resp) {
  if (!resp) return undefined;

  // caso standard
  const out = resp.output ?? resp.result ?? resp.data ?? resp;

  if (out == null) return undefined;

  // string/number/bool
  if (typeof out === "string" || typeof out === "number" || typeof out === "boolean") return out;

  // array -> primo elemento
  if (Array.isArray(out)) return out.length ? out[0] : undefined;

  // object -> prova chiavi comuni
  if (typeof out === "object") {
    if ("0" in out) return out["0"];
    if ("value" in out) return out.value;

    // se c'è una sola proprietà, prendila
    const keys = Object.keys(out);
    if (keys.length === 1) return out[keys[0]];

    // fallback: niente
    return undefined;
  }

  return undefined;
}

async function ffQueryWithFallback(role, apiName, method, tokenId) {
  // 1) prova input “normale”
  try {
    return await ffQuery(role, apiName, method, { tokenId: String(tokenId) });
  } catch {
    // ignore
  }

  // 2) fallback multi-formato
  for (const a of tokenArg(tokenId)) {
    try {
      if (Object.prototype.hasOwnProperty.call(a, "key")) {
        return await ffQuery(role, apiName, method, { tokenId: String(a.key) });
      }
      return await ffQuery(role, apiName, method, a);
    } catch {
      // continua
    }
  }

  throw new Error(`Query failed for ${method}(${tokenId})`);
}

export async function buildInventory(role, address) {
  const addr = lc(address);
  const items = [];

  // nextId
  const nextIdRes = await ffQuery(role, "WatchNFT_API", "nextId", {});
  const nextIdRaw = unwrapFFOutput(nextIdRes);
  const nextId = Number(nextIdRaw || 0);

  // LOG utile per debug (vedi terminal backend)
  console.log(`[inventory] role=${role} address=${address} nextIdRaw=`, nextIdRaw, " nextId=", nextId);

  // token esistenti 1..nextId
  // (nel tuo contratto tokenId = ++nextId, quindi i mintati sono [1..nextId])
  for (let i = 1; i <= nextId; i++) {
    try {
      const ownerRes = await ffQueryWithFallback(role, "WatchNFT_API", "ownerOf", i);
      const owner = String(unwrapFFOutput(ownerRes) || "");

      if (lc(owner) !== addr) continue;

      let certified = false;
      try {
        const certRes = await ffQueryWithFallback(role, "WatchNFT_API", "certified", i); // mapping public => getter certified(uint256)
        certified = Boolean(unwrapFFOutput(certRes));
      } catch {
        // se hai un metodo isCertified custom, prova anche quello (compatibilità)
        try {
          const certRes2 = await ffQueryWithFallback(role, "WatchNFT_API", "isCertified", i);
          certified = Boolean(unwrapFFOutput(certRes2));
        } catch {
          certified = false;
        }
      }

      items.push({
        tokenId: String(i),
        owner,
        certified,
      });
    } catch (e) {
      console.log(`[inventory] tokenId=${i} error:`, e?.message || e);
    }
  }

  return items;
}
