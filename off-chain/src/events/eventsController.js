import { env } from "../../env.js"; 

/**
 * Webhook Handler per eventi Blockchain.
 * Riceve notifiche da FireFly quando avviene un evento on-chain (es. Transfer, Certified).
 * Funge da ponte per aggiornare l'interfaccia utente in tempo reale.
 */
export function fireflyWebhook(req, res) {
  try {
    // 1. Sicurezza Webhook: Verifica del Shared Secret.
    // Impedisce ad attori esterni di inviare falsi eventi al backend.
    const incoming = req.headers["x-watchain-secret"];
    if (incoming !== env.WEBHOOK_SECRET) {
      console.warn("Webhook unauthorized attempt");
      return res.status(403).json({ ack: false, error: "Forbidden" });
    }

    // 2. Pattern "Fast ACK".
    // Rispondiamo subito 200 OK a FireFly per evitare che il nodo vada in loop di retry
    // se l'elaborazione successiva dovesse richiedere tempo.
    res.status(200).json({ ack: true });

    // Parsing del payload dell'evento
    const body = req.body || {};
    const be = body.blockchainEvent || {};
    const name = be.name;
    if (!name) return;

    // (Opzionale) Qui potremmo salvare l'evento su DB per storicizzazione
    // Per ora loggiamo e notifichiamo.
    const out = be.output || {};
    
    // Normalizzazione dati (unwrapFF rimuove eventuali wrapper JSON di FireFly)
    const data = {
      eventType: name,
      tokenId: unwrapFF(out.tokenId),
      price: unwrapFF(out.price),
      seller: unwrapFF(out.seller),
      buyer: unwrapFF(out.buyer),
      raw: body,
    };

    // 3. Real-Time Broadcast via Socket.io
    // Invia un segnale 'refresh' a tutti i client connessi per forzare l'aggiornamento UI.
    const io = req.app.get("io");
    if (io) {
      console.log(`[EVENT] Broadcasting ${name} via Socket.io`);
      io.emit("refresh");
    }
  } catch (e) {
    console.error("Webhook error:", e);
  }
}

// Utility per pulire i dati grezzi di FireFly
function unwrapFF(x) {
  if (x == null) return null;
  if (typeof x === "object" && "value" in x) return x.value;
  return x;
}