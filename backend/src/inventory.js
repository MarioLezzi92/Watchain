import { ffQuery } from "./firefly.js";

function lc(x) {
  return String(x || "").toLowerCase();
}

async function ffQueryWithFallback(role, apiName, method, tokenId) {
  const t = String(tokenId);

  // 1) forma classica { tokenId }
  try {
    return await ffQuery(role, apiName, method, { tokenId: t });
  } catch (e1) {
    const msg1 = JSON.stringify(e1?.response?.data || e1?.message || "");
    // 2) forma anonima { "": tokenId }
    try {
      return await ffQuery(role, apiName, method, { "": t });
    } catch (e2) {
      const msg2 = JSON.stringify(e2?.response?.data || e2?.message || "");
      // 3) forma posizionale { "0": tokenId }
      try {
        return await ffQuery(role, apiName, method, { "0": t });
      } catch (e3) {
        const last = e3?.response?.data || e3?.message || e3;
        throw new Error(
          `Query fallback failed for ${method}(${t}). First=${msg1} Second=${msg2} Last=${JSON.stringify(last)}`
        );
      }
    }
  }
}

export async function buildInventory(role, address) {
  const addr = lc(address);
  const items = [];

  const nextIdRes = await ffQuery(role, "WatchNFT_API", "nextId", {});
  const nextId = Number(nextIdRes?.output || 0);

  // tokenId 0 non esiste -> parti da 1
  for (let i = 1; i <= nextId; i++) {
    try {
      const ownerRes = await ffQueryWithFallback(role, "WatchNFT_API", "ownerOf", i);
      const certRes = await ffQueryWithFallback(role, "WatchNFT_API", "certified", i);

      const owner = lc(ownerRes?.output || "");
      const certified = String(certRes?.output || "false");

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
