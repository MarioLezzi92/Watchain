/**
 * Estrae l'output pulito dalle risposte di FireFly.
 */
export function unwrapFFOutput(resp) {
  if (!resp) return undefined;
  
  const out = resp.output ?? resp.result ?? resp.data ?? resp;
  
  if (out == null) return undefined;

  if (typeof out === "string" || typeof out === "number" || typeof out === "boolean") {
    return out;
  }

  if (Array.isArray(out)) {
    return out[0];
  }

  if (typeof out === "object") {
    const keys = Object.keys(out);
    if (keys.length === 1) return out[keys[0]];
    return out;
  }
  
  return undefined;
}

export function isAddress(a) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(a || "").trim());
}

export function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

export function parseBool(v) {
  if (typeof v === "boolean") return v;
  const s = String(v || "").trim().toLowerCase();
  return s === "true" || s === "1";
}

/**
 * Converte Wei in LUX mantenendo i decimali (formato stringa).
 * Esempio: "1500000000000000000" -> "1.5"
 */
export function weiToLuxString(wei) {
  const s = String(wei || "0").trim();
  if (!/^\d+$/.test(s)) return "0";
  if (s === "0") return "0";
  
  if (s.length <= 18) {
    const padded = s.padStart(19, '0');
    const integerPart = "0";
    const decimalPart = padded.slice(-18).replace(/0+$/, "");
    return decimalPart.length > 0 ? `${integerPart}.${decimalPart}` : integerPart;
  }
  
  const integerPart = s.slice(0, s.length - 18);
  const decimalPart = s.slice(-18).replace(/0+$/, "");
  return decimalPart.length > 0 ? `${integerPart}.${decimalPart}` : integerPart;
}