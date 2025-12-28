import { ffQuery } from "./firefly.js";

function lc(x) {
  return String(x || "").toLowerCase();
}

async function ffQueryWithFallback(role, apiName, method, tokenId) {
  const t = String(tokenId);

  // 1) forma "classica"
  try {
    return await ffQuery(role, apiName, method, { tokenId: t });
  } catch (e1) {
    const msg1 = JSON.stringify(e1?.response?.data || e1?.message || "");
    // 2) forma "argomento senza nome" => chiave vuota ""
    try {
      return await ffQuery(role, apiName, method, { "": t });
    } catch (e2) {
      const msg2 = JSON.stringify(e2?.response?.data || e2?.message || "");
      // 3) forma "positional" spesso mappata come "0"
      try {
        return await ffQuery(role, apiName, method, { "0": t });
      } catch (e3) {
        // se fallisce tutto, rilanciamo l’errore originale (più utile)
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

  console.log("INVENTORY ROLE:", role);
  console.log("INVENTORY ADDRESS:", address);

  const nextIdRes = await ffQuery(role, "WatchNFT_API", "nextId", {});
  const nextId = Number(nextIdRes?.output || 0);

  console.log("INVENTORY nextId:", nextId);

  // ✅ tokenId 0 non esiste nel tuo caso -> parti da 1
  for (let i = 1; i <= nextId; i++) {
    try {
      const ownerRes = await ffQueryWithFallback(role, "WatchNFT_API", "ownerOf", i);
      const certRes = await ffQueryWithFallback(role, "WatchNFT_API", "certified", i);

      const owner = lc(ownerRes?.output || "");
      const certified = String(certRes?.output || "false");

      console.log(`TOKEN ${i}: owner=${owner} certified=${certified}`);

      if (owner !== addr) continue;

      items.push({
        tokenId: String(i),
        owner,
        certified,
      });
    } catch (e) {
      console.log(`TOKEN ${i}: ERROR`, e?.message || e?.response?.data || e);
    }
  }

  console.log("INVENTORY items:", items);
  return items;
}
