// backend/src/ffinput.js
export function tokenArg(tokenId) {
  const s = String(tokenId).trim();

  return [
    { key: s }, // FireFly "key" (spesso coincide con tokenId string)
    { "": s }, // param anonimo (alcune config lo vogliono così)
    { tokenId: Number(tokenId) }, // tokenId numerico
    { tokenId: s }, // tokenId string
  ];
}
