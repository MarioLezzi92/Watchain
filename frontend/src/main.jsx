import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// IMPORTA I PROVIDER DI STATO GLOBALE
import { SystemProvider } from "./context/SystemContext";
import { WalletProvider } from "./context/WalletContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/*
      Avvolge l'intera applicazione nei Context Provider.
      Questo rende lo stato (Socket, Wallet, Ruoli) accessibile 
      a qualsiasi componente senza dover passare props manualmente.
      
      Ordine:
      1. SystemProvider: Gestisce connessioni socket e stato globale del sistema (Pausable).
      2. WalletProvider: Gestisce l'identità dell'utente. Dipende dal sistema.
    */}
    <SystemProvider>
      <WalletProvider>
        <App />
      </WalletProvider>
    </SystemProvider>
  </React.StrictMode>
);