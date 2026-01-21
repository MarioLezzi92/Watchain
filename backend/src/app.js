// src/app.js
import express from "express";
import { createServer } from "http"; // Necessario per Socket.io
import { Server } from "socket.io";  // Importa il server socket
import cors from "cors";
import { env } from "./config/env.js";

import authRoutes from "./routes/authRoutes.js";
import eventsRoutes from "./routes/eventsRoutes.js";

export function createApp() {
  const app = express();
  
  // 1. Creiamo il server HTTP avvolgendo l'app Express
  const httpServer = createServer(app);

  // 2. Inizializziamo Socket.io sul server HTTP
  const io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_ORIGIN,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  // 3. Gestione connessione Socket
  io.on("connection", (socket) => {
    console.log(`🔌 Client connesso: ${socket.id}`);
    
    socket.on("disconnect", () => {
      console.log(`❌ Client disconnesso: ${socket.id}`);
    });
  });

  // Rendiamo 'io' disponibile nelle rotte se necessario tramite app.set
  app.set("io", io);

  app.get("/health", (req, res) => res.json({ ok: true }));
  app.use("/auth", authRoutes);
  app.use("/events", eventsRoutes);

  app.use((req, res) => res.status(404).json({ error: "Not found" }));

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  });

  // RITORNIAMO httpServer invece di app
  return httpServer;
}

// 4. AVVIO DEL SERVER
const server = createApp();
const port = env.PORT || 3001;

server.listen(port, () => {
  console.log(`🚀 Server & Sockets attivi sulla porta ${port}`);
  console.log(`📡 Frontend autorizzato: ${env.FRONTEND_ORIGIN}`);
});