import { unwrapFFOutput } from "../utils/formatters.js";
import { config } from "../config/env.js";
/**
 * GESTORE WEBHOOK (Blockchain -> Backend -> Frontend)
 * * Quando FireFly rileva un evento sulla blockchain (es. "Sold", "Certified"),
 * chiama questo endpoint. Viene passato al frontend via WebSocket.
 */



export const handleFireFlyWebhook = (req, res) => {
  
  try {
    
    const incomingSecret = req.headers["x-watchchain-secret"];
    if (incomingSecret !== config.webhookSecret) {
      console.warn(" Webhook ricevuto con secret non valido:", incomingSecret);
      return res.status(403).json({ error: "Forbidden" });
    }

  
    //  ACK IMMEDIATO a FireFly per evitare che riprovi all'infinito.
    res.status(200).json({ ack: true });

    const body = req.body;
    
    console.log(" Webhook ricevuto da FireFly!");

    
    const blockchainEvent = body.blockchainEvent || {};
    const eventName = blockchainEvent.name; // Es: "Listed", "Purchased", "Canceled"
    const output = blockchainEvent.output || {};

    if (!eventName) {
      console.log(" Evento senza nome, ignorato.");
      return;
    }

    //  PULIZIA DATI: Togle i wrapper tecnici di FireFly per avere un JSON pulito.
    const cleanData = {
      tokenId: unwrapFFOutput(output.tokenId),
      price: output.price ? unwrapFFOutput(output.price) : null,
      seller: output.seller ? unwrapFFOutput(output.seller) : null,
      buyer: output.buyer ? unwrapFFOutput(output.buyer) : null,
      eventType: eventName // Passa il tipo così il frontend sa che fare
    };

    console.log(` Evento processato: ${eventName} -> Token #${cleanData.tokenId}`);

    // BROADCAST: Invia il messaggio a TUTTI i client connessi al sito.
    const io = req.app.get("io");
    
    // Emette un messaggio globale su un canale unico
    io.emit("market-update", cleanData);

  } catch (err) {
    console.error(" Errore critico nel Webhook:", err);
  }
};