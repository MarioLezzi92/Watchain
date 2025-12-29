// backend/src/wallet.js
import { ffQuery, ffInvoke } from "./firefly.js";

const LUX_API = "LuxuryCoin_API";

function isAddress(a) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(a || "").trim());
}

function unwrapFFOutput(resp) {
  if (!resp) return undefined;
  const out = resp.output ?? resp.result ?? resp.data ?? resp;
  if (out == null) return undefined;
  if (typeof out === "string" || typeof out === "number" || typeof out === "boolean") return out;
  if (Array.isArray(out)) return out[0];
  if (typeof out === "object") {
    const keys = Object.keys(out);
    if (keys.length === 1) return out[keys[0]];
    return out;
  }
  return undefined;
}

async function ffQueryWithFallback(role, apiName, method, argName, value) {
  // OZ ERC20: balanceOf(address account)
  const v = String(value);
  const attempts = [
    { [argName]: v }, // { account: v }
    { owner: v },
    { _owner: v },
    { "": v },
    { "0": v },
  ];
  let lastErr;
  for (const input of attempts) {
    try {
      return await ffQuery(role, apiName, method, input);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export async function getLuxBalanceWei(address) {
  const addr = String(address || "").trim();
  if (!isAddress(addr)) throw new Error("Invalid address for balance");

  // query può essere fatta da qualunque org, uso producer per semplicità
  const res = await ffQueryWithFallback("producer", LUX_API, "balanceOf", "account", addr);
  return String(unwrapFFOutput(res) ?? "0");
}

export function weiToLuxString(wei) {
  const s = String(wei || "0").trim();
  if (!/^\d+$/.test(s)) return "0";
  // 18 decimals -> per UI ti basta intero (LUX)
  if (s.length <= 18) return "0";
  return s.slice(0, s.length - 18);
}

export async function transferLuxFromProducer(to, amountWei) {
  const addr = String(to || "").trim();
  if (!isAddress(addr)) throw new Error("transferLux: invalid 'to'");

  const value = String(amountWei ?? "").trim();
  if (!/^\d+$/.test(value)) throw new Error("transferLux: amountWei must be integer string");

  return ffInvoke("producer", LUX_API, "transfer", { to: addr, value });
}

/**
 * Auto-funding al login: se l'utente è in whitelist e ha saldo < targetLux,
 * il producer gli invia (targetLux - saldo) LUX.
 *
 * Usa la whitelist "semplice" che già hai:
 * PRODUCER_ADDR, RESELLER_ADDR, CONSUMER_ADDR
 *
 * (Se vuoi whitelist multiple per ruolo, lo estendiamo dopo.)
 */
export async function ensureFundedOnLogin(address, role, targetLux = 100) {
  const addr = String(address || "").trim();
  if (!isAddress(addr)) return { ok: false, skipped: true, reason: "invalid address" };

  const r = String(role || "").toLowerCase().trim();

  // whitelist per ruolo (come nel tuo .env)
  const wl = new Set(
    [
      String(process.env.PRODUCER_ADDR || "").trim(),
      String(process.env.RESELLER_ADDR || "").trim(),
      String(process.env.CONSUMER_ADDR || "").trim(),
    ]
      .filter(Boolean)
      .map((x) => x.toLowerCase())
  );

  if (!wl.has(addr.toLowerCase())) {
    return { ok: true, skipped: true, reason: "not whitelisted" };
  }

  // puoi anche decidere di non fundare il producer
  if (r === "producer") {
    return { ok: true, skipped: true, reason: "producer not funded" };
  }

  const target = Number(targetLux);
  if (!Number.isFinite(target) || target <= 0) return { ok: false, skipped: true, reason: "bad target" };

  const balWei = await getLuxBalanceWei(addr);
  const balLux = Number(weiToLuxString(balWei) || "0");

  if (balLux >= target) {
    return { ok: true, skipped: true, reason: "already funded", balanceLux: balLux };
  }

  const deltaLux = target - balLux;
  const deltaWei = `${deltaLux}000000000000000000`;

  const tx = await transferLuxFromProducer(addr, deltaWei);
  return { ok: true, funded: true, amountLux: deltaLux, balanceLuxBefore: balLux, tx };
}
