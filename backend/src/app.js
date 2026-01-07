import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { config } from "./config/env.js";

// Importiamo le rotte
import routes from "./routes/index.js";
// ECCO LA CORREZIONE: ora punta a "eventsRoutes.js" (plurale)
import eventsRoutes from "./routes/eventsRoutes.js"; 

const app = express();

// 1. Creiamo il server HTTP per i Socket
const server = http.createServer(app);

// 2. Configuriamo Socket.io
const io = new Server(server, {
  cors: {
    origin: config.frontendOrigin || "http://localhost:5173", 
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Rendiamo 'io' disponibile ovunque
app.set("io", io);

// Middleware
app.use(cors({
  origin: config.frontendOrigin || true,
  credentials: true,
}));
app.use(express.json());

// Log socket
io.on("connection", (socket) => {
  console.log("🔌 Frontend connesso al Socket:", socket.id);
});

console.log("Configuration Loaded:");
console.log(`- Market Contract: ${config.watchMarketAddress}`);

app.get("/", (req, res) => res.send("WatchDApp Backend v2.0 is Running"));

// 3. ROTTE
app.use("/api", routes);
app.use("/api/events", eventsRoutes);

// Error Handler
app.use((err, req, res, next) => {
  console.error("[Global Error]", err.stack);
  res.status(500).json({ error: "Internal Server Error", message: err.message });
});

// 4. AVVIO
server.listen(config.port, () => {
  console.log(`\n🚀 Server & Socket listening on http://localhost:${config.port}`);
});