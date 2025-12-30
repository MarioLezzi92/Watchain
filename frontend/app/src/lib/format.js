export function isHexAddress(a) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(a || "").trim());
}

export function weiToLux(wei) {
  const s = String(wei ?? "").trim();
  if (!/^\d+$/.test(s)) return "-";

  // LOGICA IBRIDA:
  // Se ha meno di 15 cifre, è un numero "semplice" (es. 10, 100). Lo mostriamo così com'è.
  if (s.length < 15) {
    return s;
  }

  // Se ha più di 15 cifre, è un residuo "Wei" (vecchi dati). Lo convertiamo per pulizia.
  if (s.length <= 18) {
    const pad = s.padStart(19, "0");
    const intPart = pad.slice(0, -18).replace(/^0+/, "") || "0";
    const frac = pad.slice(-18).replace(/0+$/, "");
    return frac ? `${intPart}.${frac.substring(0, 4)}` : intPart;
  }
  
  const intPart = s.slice(0, -18);
  const frac = s.slice(-18).replace(/0+$/, "");
  return frac ? `${intPart}.${frac.substring(0, 4)}` : intPart;
}

export function luxIntToWei18(luxInt) {
  // Non la usiamo più attivamente, ma la lasciamo per compatibilità
  const n = String(luxInt ?? "").trim();
  if (!n) throw new Error("Inserisci un prezzo in LUX.");
  if (!/^\d+$/.test(n)) throw new Error("Prezzo non valido.");
  return `${n}000000000000000000`;
}