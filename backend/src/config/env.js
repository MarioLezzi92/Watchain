import dotenv from "dotenv";
dotenv.config();

function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const env = {
  // sensibili
  JWT_SECRET: must("JWT_SECRET"),
  WEBHOOK_SECRET: must("WEBHOOK_SECRET"),

  // non sensibili: hardcoded per ordine (come vuoi tu)
  PORT: 3001,
  FRONTEND_ORIGIN: "http://localhost:5173",

  // policy: hardcoded
  JWT_TTL: "1h",
  NONCE_TTL_MS: 5 * 60 * 1000, // 5 minuti

  // ruoli (whitelist)
  PRODUCER_ADDR: must("PRODUCER_ADDR"),
  RESELLER_ADDR: must("RESELLER_ADDR"),
  CONSUMER_ADDR: must("CONSUMER_ADDR"),
};
