import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

import { env } from "../env.js";

import authRoutes from "./auth/authRoutes.js";
import eventsRoutes from "./events/eventsRoutes.js";
import { verifyJwt } from "./auth/jwt.js"; 

export function createApp() {
  const app = express();
  const httpServer = createServer(app);

  // JWT via Authorization header / socket handshake => niente cookie => credentials false
  const corsOptions = {
    origin: env.FRONTEND_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: false,
    allowedHeaders: ["Content-Type", "Authorization", "x-watchain-secret"],
  };

  app.use(cors(corsOptions));
  app.use(express.json({ limit: "1mb" }));

  const io = new Server(httpServer, { cors: corsOptions });

  // Autenticazione Socket.IO via JWT
  io.use((socket, next) => {
    try {
      const authToken = socket.handshake.auth?.token;

      const headerAuth = socket.handshake.headers?.authorization || "";
      const headerToken = headerAuth.replace(/^Bearer\s+/i, "").trim();

      const token = authToken || headerToken;
      if (!token) return next(new Error("unauthorized"));

      const payload = verifyJwt(token);
      const address = payload?.sub || payload?.account;
      if (!address) return next(new Error("unauthorized"));

      socket.user = { address };
      // opzionale: room per invii mirati
      socket.join(address);

      return next();
    } catch {
      return next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    // Qui socket.user.address è disponibile
     console.log("Socket connected:", socket.user.address);

    socket.on("disconnect", () => {
       console.log("Socket disconnected:", socket.user?.address);
    });
  });

  app.set("io", io);

  app.use("/auth", authRoutes);
  app.use("/events", eventsRoutes);

  // Error handler minimale
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  });

  return httpServer;
}

const server = createApp();
const port = env.PORT || 3001;

server.listen(port, () => {
  console.log(`🚀 Off-chain attivo sulla porta ${port}`);
});
