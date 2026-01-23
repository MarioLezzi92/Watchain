export const env = {
  // --- SEGRETI normalmente non dovrebbero essere qui ---
  JWT_SECRET: "supersecret-change-me",
  WEBHOOK_SECRET: "supersecret-watchain-123",

  // --- CONFIGURAZIONE SERVER ---
  PORT: 3001,
  FRONTEND_ORIGIN: "http://localhost:5173",

  // --- FIREFLY URLs (Aggiunti dal vecchio .env) ---
  FF_PRODUCER_BASE: "http://127.0.0.1:5000/api/v1/namespaces/default",
  FF_RESELLER_BASE: "http://127.0.0.1:5001/api/v1/namespaces/default",
  FF_CONSUMER_BASE: "http://127.0.0.1:5002/api/v1/namespaces/default",

  // --- POLICY ---
  JWT_TTL: "1h",
  NONCE_TTL_MS: 5 * 60 * 1000, // 5 minuti
};