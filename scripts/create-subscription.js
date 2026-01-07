import axios from "axios";

// URL della CLI di FireFly (Nodo 1)
const FIREFLY_API = "http://127.0.0.1:5000/api/v1/namespaces/default";

async function createSubscription() {
  console.log("🔌 Creazione Subscription automatica verso FireFly...");

  const payload = {
    name: "WatchDApp_Live_Events",
    transport: "webhooks", // Usa il plugin nativo webhooks, è più robusto di 'http'
    options: {
      // Usa host.docker.internal perché FireFly gira in Docker e deve uscire verso il tuo PC
      url: "http://host.docker.internal:3001/api/events/firefly-webhook",
      withData: true, // Fondamentale: invia tutto il payload JSON dell'evento
      reply: false    // Fire-and-forget: FireFly non aspetta la tua risposta per proseguire
    },
    filter: {
      // QUESTO è quello che serve al tuo eventsController.js
      events: "blockchain_event_received" 
    }
  };

  try {
    // 1. Prova a creare la subscription
    const { data } = await axios.post(`${FIREFLY_API}/subscriptions`, payload);
    console.log("✅ Subscription creata con successo! ID:", data.id);
    
  } catch (err) {
    // 2. Gestione caso "già esistente" (409 Conflict)
    if (err.response && err.response.status === 409) {
      console.log("⚠️ La Subscription esiste già. Nessuna azione necessaria.");
    } else {
      console.error("❌ Errore:", err.response ? err.response.data : err.message);
    }
  }
}

createSubscription();