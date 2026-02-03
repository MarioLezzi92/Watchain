import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";

import { env } from "../env.js";
import authRoutes from "./auth/authRoutes.js";
import eventsRoutes from "./events/eventsRoutes.js";
import { verifyAccessJwt } from "./auth/jwt.js";
import fireflyRoutes from "./firefly/fireflyRoutes.js";

/**
 * Utility per il parsing manuale dei cookie dagli header WebSocket.
 */
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i === -1) return;
    const k = p.slice(0, i).trim();
    const v = decodeURIComponent(p.slice(i + 1).trim());
    out[k] = v;
  });
  return out;
}

export function createApp() {
  const app = express();
  const httpServer = createServer(app);

  app.use(cookieParser());
  
  // Configurazione CORS Sicura
  // credentials: true è obbligatorio per permettere l'invio/ricezione di cookie HttpOnly.
  app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  // Inizializzazione Server WebSocket
  const io = new Server(httpServer, {
    cors: { origin: env.FRONTEND_ORIGIN, methods: ["GET", "POST"], credentials: true },
  });

  // --- SOCKET.IO SECURITY MIDDLEWARE ---
  // Protegge il canale WebSocket riutilizzando lo stesso Access Token (JWT) delle API REST.
  // Se il cookie 'access_token' non è valido, la connessione socket viene rifiutata.
  io.use((socket, next) => {
    try {
      // 1. Estrazione cookie dall'handshake iniziale
      const cookies = parseCookies(socket.handshake.headers.cookie || "");
      const token = cookies.access_token;
      
      if (!token) return next(new Error("unauthorized"));

      // 2. Verifica validità token (Stateless verification)
      const payload = verifyAccessJwt(token);
      
      // 3. Associazione identità al socket
      socket.user = { address: payload.sub };
      return next();
    } catch {
      return next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    // Room privata per utente (utile per notifiche personali future)
    socket.join(socket.user.address);
  });

  // Rendiamo 'io' disponibile globalmente in req.app.get("io")
  app.set("io", io);

  // Registrazione Route Modulari
  app.use("/auth", authRoutes);       // Autenticazione & Sessione
  app.use("/events", eventsRoutes);   // Webhook & Notifiche
  app.use("/firefly", fireflyRoutes); // Secure Transaction Proxy

  return httpServer;
}

const server = createApp();
const port = env.PORT || 3001;

server.listen(port, () => {
  console.log(`🚀 Off-chain Backend attivo sulla porta ${port}`);
});