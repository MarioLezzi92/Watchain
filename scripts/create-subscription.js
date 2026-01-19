import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs"; // Importiamo fs per verificare se il file esiste davvero


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../backend/.env");


if (!fs.existsSync(envPath)) {
  process.exit(1);
}

// Carica il file
dotenv.config({ path: envPath });
// ------------------------------------

const FIREFLY_API = "http://127.0.0.1:5000/api/v1/namespaces/default";

async function createSubscription() {
  console.log(" Creazione Subscription automatica verso FireFly...");

  const secret = process.env.WEBHOOK_SECRET;

  if (!secret) {
    console.error(" ERRORE: Variabile WEBHOOK_SECRET vuota o non trovata nel .env");
    process.exit(1);
  } else {
    console.log(" Segreto trovato ");
  }

  const payload = {
    name: "WatchDApp_Live_Events", // Nome univoco
    transport: "webhooks",
    options: {
      url: "http://host.docker.internal:3001/api/events/firefly-webhook",
      withData: true,
      reply: false,
      headers: {
        "x-watchchain-secret": secret 
      }
    },
    filter: {
      events: "blockchain_event_received" 
    }
  };

  try {
    const { data } = await axios.post(`${FIREFLY_API}/subscriptions`, payload);
    console.log(" Subscription creata con successo! ID:", data.id);
  } catch (err) {
    if (err.response && err.response.status === 409) {
      console.log(" La subscription esiste già.");
    } else {
      console.error(" Errore HTTP:", err.message);
      if(err.response) console.error("   Dettaglio:", err.response.data);
    }
  }
}

createSubscription();