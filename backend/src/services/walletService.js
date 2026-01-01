import { ffQuery, ffInvoke } from "./fireflyService.js";
import { unwrapFFOutput, isAddress, normalizeRole } from "../utils/formatters.js";

const LUX_API = "LuxuryCoin_API";

// Helper per gestire query con fallback (come nel tuo vecchio file)
async function ffQueryWithFallback(role, apiName, method, argName, value) {
  const v = String(value);
  // Prova diverse chiavi per l'argomento (account, owner, ecc)
  const attempts = [{ [argName]: v }, { owner: v }, { _owner: v }, { "": v }];
  
  let lastErr;
  for (const input of attempts) {
    try {
      return await ffQuery(role, apiName, method, input);
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

export async function getBalance(role, address) {
  // Nota: la query balanceOf è in lettura, potremmo usare un ruolo qualsiasi,
  // ma usiamo quello dell'utente per coerenza (o producer se serve fallback).
  // Nel tuo vecchio codice usavi "producer" fisso per le query di balance,
  // qui possiamo usare il ruolo dell'utente se valido, o producer.
  const queryRole = ["producer", "reseller", "consumer"].includes(role) ? role : "producer";
  
  const res = await ffQueryWithFallback(queryRole, LUX_API, "balanceOf", "account", address);
  return unwrapFFOutput(res) || "0";
}

export async function transferLux(fromRole, to, amountWei) {
  const r = normalizeRole(fromRole);
  // Nel tuo caso, di solito solo il Producer invia LUX direttamente
  if (r !== "producer") throw new Error("Only producer can transfer LUX via API");
  
  if (!isAddress(to)) throw new Error("Invalid 'to' address");

  return ffInvoke(r, LUX_API, "transfer", { 
    to, 
    value: String(amountWei) 
  });
}