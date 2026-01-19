import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// IMPORTA I DUE PROVIDER
import { SystemProvider } from "./context/SystemContext";
import { WalletProvider } from "./context/WalletContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SystemProvider>
      <WalletProvider>
        <App />
      </WalletProvider>
    </SystemProvider>
  </React.StrictMode>
);