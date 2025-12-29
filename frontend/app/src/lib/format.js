// frontend/app/src/lib/format.js
export function isHexAddress(a) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(a || "").trim());
}

export function weiToLux(wei) {
  const s = String(wei ?? "").trim();
  if (!/^\d+$/.test(s)) return "-";
  if (s.length <= 18) {
    const pad = s.padStart(19, "0");
    const intPart = pad.slice(0, -18).replace(/^0+/, "") || "0";
    const frac = pad.slice(-18).replace(/0+$/, "");
    return frac ? `${intPart}.${frac}` : intPart;
  }
  const intPart = s.slice(0, -18);
  const frac = s.slice(-18).replace(/0+$/, "");
  return frac ? `${intPart}.${frac}` : intPart;
}

export function luxIntToWei18(luxInt) {
  const n = String(luxInt ?? "").trim();
  if (!n) throw new Error("Inserisci un prezzo in LUX.");
  if (!/^\d+$/.test(n)) throw new Error("Prezzo non valido: usa un intero (es. 22).");
  return `${n}000000000000000000`;
}
