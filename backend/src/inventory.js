import { ffQuery } from "./firefly.js";
//import { ffBaseForRole } from "./ff.js";
//const FF_BASE = ffBaseForRole(role);

export async function buildInventory(role) {
  console.log("BUILD INVENTORY role =", role);

  const nextIdRes = await ffQuery(role, "WatchNFT_API", "nextId");
  const max = Number(nextIdRes.output);

  console.log("max tokenId =", max);

  const items = [];

  for (let tokenId = 0; tokenId < max; tokenId++) {
    const tokenKey = String(tokenId);


    const ownerRes = await ffQuery(role, "WatchNFT_API", "owner", { "": tokenId });
    const certRes  = await ffQuery(role, "WatchNFT_API", "certified", { "": tokenId });

    items.push({
      tokenId,
      owner: ownerRes.output,
      certified: certRes.output,
    });
  }

  return items;
}
