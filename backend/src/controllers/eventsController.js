// src/controllers/eventsController.js
import { unwrapFFOutput } from "../utils/formatters.js";

export const handleFireFlyWebhook = (req, res) => {
  try {
    // 1. FireFly si aspetta una risposta VELOCE (entro pochi secondi)
    // Rispondiamo subito "200 OK" per dirgli "Messaggio ricevuto, grazie!"
    // Se non lo facciamo, FireFly penserà che siamo morti e riproverà all'infinito.
    res.status(200).json({ ack: true });

    const body = req.body;
    
    // Logghiamo per debug (così vedi nel terminale cosa arriva)
    console.log("📨 Webhook ricevuto da FireFly!");

    // 2. Estraiamo i dati utili
    // FireFly mette i dati dell'evento dentro "blockchainEvent"
    const blockchainEvent = body.blockchainEvent || {};
    const eventName = blockchainEvent.name; // Es: "Listed", "Purchased", "Canceled"
    const output = blockchainEvent.output || {};

    if (!eventName) {
      console.log("⚠️ Evento senza nome, ignorato.");
      return;
    }

    // 3. Puliamo i dati (togliamo i wrapper di FireFly)
    // Nota: I nomi dei campi (seller, price, tokenId) dipendono dal tuo Smart Contract!
    const cleanData = {
      tokenId: unwrapFFOutput(output.tokenId),
      price: output.price ? unwrapFFOutput(output.price) : null,
      seller: output.seller ? unwrapFFOutput(output.seller) : null,
      buyer: output.buyer ? unwrapFFOutput(output.buyer) : null,
      eventType: eventName // Passiamo il tipo così il frontend sa che fare
    };

    console.log(`🔔 Evento processato: ${eventName} -> Token #${cleanData.tokenId}`);

    // 4. SPARA AL FRONTEND VIA SOCKET! 🚀
    // Recuperiamo l'istanza 'io' che abbiamo salvato in app.js
    const io = req.app.get("io");
    
    // Emettiamo un messaggio globale su un canale unico
    io.emit("market-update", cleanData);

  } catch (err) {
    console.error("❌ Errore critico nel Webhook:", err);
    // Nota: Anche se c'è errore, abbiamo già risposto 200 a FireFly.
    // Questo è voluto: non vogliamo bloccare la coda di FireFly per un nostro bug.
  }
};