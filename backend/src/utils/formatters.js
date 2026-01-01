/**
 * Estrae l'output pulito dalle risposte di FireFly.
 */
export function unwrapFFOutput(resp) {
  if (!resp) return undefined;
  
  // 1. Cerca il campo dati principale
  const out = resp.output ?? resp.result ?? resp.data ?? resp;
  
  if (out == null) return undefined;

  // 2. Se è già un primitivo, ritornalo
  if (typeof out === "string" || typeof out === "number" || typeof out === "boolean") {
    return out;
  }

  // 3. Se è un array, prendi il primo elemento (spesso i return singoli sono array di 1 elemento)
  if (Array.isArray(out)) {
    return out[0];
  }

  // 4. Se è un oggetto con una sola chiave (es. { "certified": true } o { "": true }), ritorna il valore
  if (typeof out === "object") {
    const keys = Object.keys(out);
    if (keys.length === 1) return out[keys[0]];
    // Se ha più chiavi, potrebbe essere una struct, ritorniamo tutto l'oggetto
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

export function weiToLuxString(wei) {
  const s = String(wei || "0").trim();
  if (!/^\d+$/.test(s)) return "0";
  if (s.length <= 18) return "0";
  return s.slice(0, s.length - 18);
}