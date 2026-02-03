import { env } from "../../env.js";

// Mapping delle porte interne dei nodi FireFly.
// Questi nodi non sono esposti pubblicamente; solo il backend può contattarli.
const NODES = {
  producer: env.FF_PRODUCER_BASE, // Es. 127.0.0.1:5000
  reseller: env.FF_RESELLER_BASE, // Es. 127.0.0.1:5001
  consumer: env.FF_CONSUMER_BASE  // Es. 127.0.0.1:5002
};

/**
 * Proxy Sicuro per Transazioni Blockchain (Write Operations).
 * 
 * 1. Riceve la richiesta dal client.
 * 2. Ignora qualsiasi tentativo del client di specificare la chiave di firma ('key').
 * 3. Sovrascrive la chiave utilizzando l'indirizzo garantito dal JWT (req.user.address).
 * * Questo impedisce tassativamente l'Impersonificazione (Identity Spoofing).
 */
export async function proxyInvoke(req, res) {
  try {
    // SECURITY: L'identità (signer) deriva ESCLUSIVAMENTE dal token di sessione validato.
    // req.user.address è popolato dal middleware 'requireAuth'.
    const safeAddress = req.user.address; 
    
    // Parametri della chiamata funzionale
    const { role, api, method, input } = req.body;

    // Routing interno verso il nodo corretto
    const baseUrl = NODES[role] || NODES.consumer; 
    
    // Costruzione URL FireFly (flag confirm=true per attesa mining)
    const fireflyUrl = `${baseUrl}/apis/${api}/invoke/${method}?confirm=true`;

    console.log(`[PROXY] Signing transaction for authenticated user: ${safeAddress} on node: ${role}`);

    // Server-to-Server Request
    const ffResponse = await fetch(fireflyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: input || {},
        
        // --- SECURITY ENFORCEMENT ---
        // Forziamo la proprietà 'key' con l'indirizzo verificato.
        // Anche se un attaccante inviasse un body con "key": "0xAdmin", verrebbe ignorato.
        key: safeAddress 
      })
    });

    const data = await ffResponse.json();
    
    // Proxy trasparente: inoltra lo status e la risposta originale di FireFly
    return res.status(ffResponse.status).json(data);

  } catch (e) {
    console.error("Proxy Error:", e);
    return res.status(500).json({ error: e.message });
  }
}