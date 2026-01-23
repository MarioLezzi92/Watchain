import { fetch } from "undici"; 
// ESCI da scripts ed ENTRA in off-chain per trovare env.js
import { env } from "../off-chain/env.js";

const FF_BASE = env.FF_PRODUCER_BASE; 
const TOPIC_NAME = "app-events"; 

// FireFly (dentro Docker) deve chiamare il server off-chain (fuori)
const BACKEND_WEBHOOK = `http://host.docker.internal:${env.PORT}/events/webhook`; 

async function main() {
  console.log("=== 🔗 SETUP WEBHOOK (WATCHCHAIN) ===");
  console.log(`Target: ${BACKEND_WEBHOOK}`);

  const payload = {
    name: "watchain_webhook",
    transport: "webhooks",
    filter: { events: "blockchain_event_received", topic: TOPIC_NAME },
    options: {
      url: BACKEND_WEBHOOK,
      method: "POST",
      // Utilizziamo il segreto per proteggere la comunicazione
      headers: { "x-watchain-secret": env.WEBHOOK_SECRET }, 
      withData: true
    }
  };

  try {
    const res = await fetch(`${FF_BASE}/subscriptions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.status === 409) {
      console.log("✅ Webhook già esistente.");
    } else if (res.ok) {
      console.log("🚀 Webhook creato con successo!");
    } else {
      const txt = await res.text();
      console.error(`❌ Errore: ${res.status} - ${txt}`);
    }
  } catch (error) {
    console.error(`?? Errore di rete: ${error.message}`);
  }
}

main();