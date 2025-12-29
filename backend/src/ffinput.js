// backend/src/ffinput.js
export function tokenArg(tokenId) {
  const s = String(tokenId).trim();

  return [
    { key: s },                   // FireFly "key"
    { "": s },                    // param anonimo visto in alcuni casi
    { tokenId: Number(tokenId) }, // tokenId numerico (fallback)
    { tokenId: s },               // tokenId string
  ];
}
