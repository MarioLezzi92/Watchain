import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Caricamento .env
const envPath = path.join(__dirname, "../../.env");
dotenv.config({ path: envPath });

// 2. Funzione di Validazione 
function requireEnv(key, fallback = null) {
  const value = process.env[key];
  if (!value && fallback === null) {
    console.error(`[FATAL ERROR] Manca la variabile d'ambiente obbligatoria: ${key}`);
    console.error(`Verifica il file: ${envPath}`);
    process.exit(1); 
  }
  return value || fallback;
}

// 3. Export Configurazione Validata
export const config = {
  // Server
  port: requireEnv("PORT", "3001"),
  jwtSecret: requireEnv("JWT_SECRET"),
  frontendOrigin: requireEnv("FRONTEND_ORIGIN", "*"),
  
  // FireFly Nodes 
  producerBase: requireEnv("FF_PRODUCER_BASE"),
  resellerBase: requireEnv("FF_RESELLER_BASE"),
  consumerBase: requireEnv("FF_CONSUMER_BASE"),

  // Smart Contracts
  luxuryCoinAddress: requireEnv("LUXURYCOIN_ADDRESS"),
  watchNFTAddress: requireEnv("WATCHNFT_ADDRESS"),
  watchMarketAddress: requireEnv("WATCHMARKET_ADDRESS"),

  // Whitelisted Addresses
  producerAddr: requireEnv("PRODUCER_ADDR"),
  resellerAddr: requireEnv("RESELLER_ADDR"),
  consumerAddr: requireEnv("CONSUMER_ADDR"),
};
