// backend/src/utils/formatters.js
// SOLO INTERI: 1 LUX = 10^18 Wei

const DECIMALS = 10n ** 18n;

function isUnsignedIntegerString(s) {
  return typeof s === "string" && /^[0-9]+$/.test(s.trim());
}

/**
 * FireFly unwrap: alcune risposte possono essere { value: ... }
 */
export function unwrapFF(x) {
  if (x == null) return null;
  if (typeof x === "object" && "value" in x) return x.value;
  return x;
}

export function parseBool(v) {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1";
}

export function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

/**
 * LUX (intero) -> Wei (string)
 * Es: "15" -> "15000000000000000000"
 */
export function luxToWeiString(amountLux) {
  const s = String(amountLux ?? "").trim();

  // Consenti vuoto o "0"
  if (s === "" || s === "0") return "0";

  if (!isUnsignedIntegerString(s)) {
    throw new Error("Formato importo non valido: sono ammessi solo interi non negativi");
  }

  // Normalizza tipo (evita numeri JS)
  const lux = BigInt(s);
  return (lux * DECIMALS).toString();
}

/**
 * Wei (string/number/bigint) -> LUX (string intera)
 * Es: "15000000000000000000" -> "15"
 */
export function weiToLuxString(wei) {
  try {
    const s = String(wei ?? "0").trim();
    if (s === "" || s === "0") return "0";
    if (!isUnsignedIntegerString(s)) return "0";

    const w = BigInt(s);
    return (w / DECIMALS).toString(); // divisione intera => niente decimali
  } catch {
    return "0";
  }
}
