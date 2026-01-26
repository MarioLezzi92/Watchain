import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";

import { env } from "../env.js";
import authRoutes from "./auth/authRoutes.js";
import eventsRoutes from "./events/eventsRoutes.js";
import { verifyAccessJwt } from "./auth/jwt.js";

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
  app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  const io = new Server(httpServer, {
    cors: { origin: env.FRONTEND_ORIGIN, methods: ["GET", "POST"], credentials: true },
  });

  // Socket auth via access_token cookie
  io.use((socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie || "");
      const token = cookies.access_token;
      if (!token) return next(new Error("unauthorized"));

      const payload = verifyAccessJwt(token);
      socket.user = { address: payload.sub };
      return next();
    } catch {
      return next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(socket.user.address);
  });

  app.set("io", io);

  app.use("/auth", authRoutes);
  app.use("/events", eventsRoutes);

  return httpServer;
}

const server = createApp();
const port = env.PORT || 3001;

server.listen(port, () => {
  console.log(`🚀 Off-chain attivo sulla porta ${port}`);
});
