import { env } from "../../env.js"; 

export function fireflyWebhook(req, res) {
  try {
    // Protezione semplice via shared secret
    const incoming = req.headers["x-watchain-secret"];
    if (incoming !== env.WEBHOOK_SECRET) {
      return res.status(403).json({ ack: false, error: "Forbidden" });
    }

    // ACK subito
    res.status(200).json({ ack: true });

    const body = req.body || {};
    const be = body.blockchainEvent || {};
    const name = be.name;
    if (!name) return;

    const out = be.output || {};
    
    const data = {
      eventType: name,
      tokenId: unwrapFF(out.tokenId),
      price: unwrapFF(out.price),
      seller: unwrapFF(out.seller),
      buyer: unwrapFF(out.buyer),
      raw: body,
    };

    // Push live via Socket.io
    const io = req.app.get("io");
    if (io) {
      io.emit("refresh", data);
    }
  } catch (e) {
    console.error("Webhook error:", e);
  }
}

function unwrapFF(x) {
  if (x == null) return null;
  if (typeof x === "object" && "value" in x) return x.value;
  return x;
}