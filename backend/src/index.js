// backend/src/index.js
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// carica SEMPRE backend/.env (indipendente da dove lanci node)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import express from "express";
import cors from "cors";

import { getNonce, login } from "./auth.js";
import routes from "./routes.js";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || true,
    credentials: true,
  })
);

app.use(express.json());

app.get("/", (req, res) => res.send("Backend OK"));

app.get("/auth/nonce", getNonce);
app.post("/auth/login", login);

app.use(routes);

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
  console.log("ENV CHECK:", {
    PORT: process.env.PORT,
    FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
    FF_PRODUCER_BASE: process.env.FF_PRODUCER_BASE,
    FF_RESELLER_BASE: process.env.FF_RESELLER_BASE,
    FF_CONSUMER_BASE: process.env.FF_CONSUMER_BASE,
    WATCHMARKET_ADDRESS: process.env.WATCHMARKET_ADDRESS,
  });
});
