import dotenv from "dotenv";
dotenv.config();

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

app.listen(process.env.PORT || 3001, () => {
  console.log(`JWT_SECRET present? ${!!process.env.JWT_SECRET}`);
  console.log(`Backend listening on http://localhost:${process.env.PORT || 3001}`);
});
