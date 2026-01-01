import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carica il .env dalla root
dotenv.config({ path: path.join(__dirname, "../../.env") });

export const config = {
  port: process.env.PORT || 3001,
  jwtSecret: process.env.JWT_SECRET,
  frontendOrigin: process.env.FRONTEND_ORIGIN,
  
  // FireFly Base URLs
  producerBase: process.env.FF_PRODUCER_BASE,
  resellerBase: process.env.FF_RESELLER_BASE,
  consumerBase: process.env.FF_CONSUMER_BASE,

  // Indirizzi Smart Contract
  luxuryCoinAddress: process.env.LUXURYCOIN_ADDRESS,
  watchNFTAddress: process.env.WATCHNFT_ADDRESS,
  watchMarketAddress: process.env.WATCHMARKET_ADDRESS,

  // Whitelist Address (per decidere i ruoli)
  producerAddr: process.env.PRODUCER_ADDR,
  resellerAddr: process.env.RESELLER_ADDR,
  consumerAddr: process.env.CONSUMER_ADDR,
};