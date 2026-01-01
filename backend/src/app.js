import express from "express";
import cors from "cors";
import { config } from "./config/env.js";
import routes from "./routes/index.js";

const app = express();

// Middleware base
app.use(cors({
  origin: config.frontendOrigin || true, // Usa URL dal .env o consenti tutto in dev
  credentials: true,
}));

app.use(express.json());

// Log di avvio per debug (opzionale)
console.log("Configuration Loaded:");
console.log(`- Producer Base: ${config.producerBase}`);
console.log(`- Market Contract: ${config.watchMarketAddress}`);

// Health check root
app.get("/", (req, res) => res.send("WatchDApp Backend v2.0 is Running"));

// Monta tutte le API sotto il prefisso /api
// Esempio: http://localhost:3001/api/auth/login
app.use("/api", routes);

// Gestione errori globale (Global Error Handler)
app.use((err, req, res, next) => {
  console.error("[Global Error]", err.stack);
  res.status(500).json({ error: "Internal Server Error", message: err.message });
});

// Avvio server
app.listen(config.port, () => {
  console.log(`\n🚀 Server listening on http://localhost:${config.port}`);
  console.log(`👉 API Endpoint: http://localhost:${config.port}/api`);
});