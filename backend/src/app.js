import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { config } from "./config/env.js";

import routes from "./routes/index.js";
import eventsRoutes from "./routes/eventsRoutes.js"; 

const app = express();
const server = http.createServer(app);

const allowedOrigin = config.frontendOrigin || "http://localhost:5173";

const corsOptions = {
  origin: allowedOrigin,
  credentials: true, // Permette cookie/header autorizzati
  methods: ["GET", "POST"]
};

// 1. Middleware Globali
app.use(cors(corsOptions));
// Aumentiamo il limite del body per gestire payload grossi di FireFly 
app.use(express.json({ limit: "10mb" })); 

// 2. Configurazione Socket.io
const io = new Server(server, {
  cors: corsOptions // Usa la stessa config di Express
});

// Rendiamo 'io' accessibile ovunque (es. nei controller)
app.set("io", io);

io.on("connection", (socket) => {
  console.log("🔌 Client connesso al Socket:", socket.id);
  socket.on("disconnect", () => console.log("❌ Client disconnesso:", socket.id));
});

// 3. Routing
console.log("\n--- System Configuration ---");
console.log(`> Market Contract: ${config.watchMarketAddress}`);
console.log(`> Allowed Origin:  ${allowedOrigin}`);
console.log("----------------------------\n");

app.get("/", (req, res) => res.send("WatchChain Backend v2.0 - System Operational 🟢"));

// Rotte specifiche prima, poi il router generale
app.use("/api/events", eventsRoutes); // Webhooks FireFly
app.use("/api", routes);              // API Applicative (Auth, Market, etc.)

// 4. Global Error Handler (Cattura errori non gestiti dai controller)
app.use((err, req, res, next) => {
  console.error(" UNCAUGHT ERROR:", err.stack);
  res.status(500).json({ 
    success: false, 
    error: "Errore interno del server", 
    details: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

// 5. Avvio Server
server.listen(config.port, () => {
  console.log(`Server avviato su http://localhost:${config.port}`);
});