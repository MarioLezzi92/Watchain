import React, { createContext, useContext, useState, useEffect } from "react";
import { io } from "socket.io-client";
import { FF_BASE, FF, AuthAPI } from "../lib/api.js";
import { AUTH_EVENT, isLoggedIn } from "../lib/auth.js";

const BACKEND_URL = "http://localhost:3001";
const SystemContext = createContext();

export function SystemProvider({ children }) {
  // Stato Globale di Sistema (Circuit Breaker Status)
  const [marketPaused, setMarketPaused] = useState(false);
  const [factoryPaused, setFactoryPaused] = useState(false);
  
  // Trigger per aggiornamenti real-time (usato come dependency nei useEffect)
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [socket, setSocket] = useState(null);

  /**
   * VERIFICA STATO BLOCCANTE (Chain as Source of Truth)
   * Interroga direttamente i nodi per sapere se i contratti sono in pausa (Pausable).
   * Se attivi, l'UI mostra i banner di emergenza e disabilita i pulsanti critici.
   */
  const checkStatus = async () => {
    try {
      const baseUrl = FF_BASE.producer;
      // Eseguiamo in parallelo per velocità
      const [m, f] = await Promise.all([
        FF.watchMarket.query.paused(baseUrl),
        FF.watchNft.query.paused(baseUrl),
      ]);

      setMarketPaused(m?.output === true || String(m?.output) === "true");
      setFactoryPaused(f?.output === true || String(f?.output) === "true");
    } catch (error) {
      console.warn("System status check failed (Network issue?)", error);
    }
  };

  /**
   * GESTIONE CONNESSIONE WEBSOCKET
   * La connessione socket.io è protetta: invia automaticamente i cookie HttpOnly (JWT)
   * durante l'handshake. Se il cookie manca o è invalido, il backend rifiuta la connessione.
   */
  useEffect(() => {
    let socketInstance = null;

    const disconnect = () => {
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
      }
      setSocket(null);
    };

    const connect = async () => {
      // 1. Pre-check locale
      if (!isLoggedIn()) {
        disconnect();
        return;
      }

      // 2. Pre-check server (Valida sessione / Refresh token se necessario)
      // Se questa chiamata fallisce, significa che la sessione è scaduta -> niente socket.
      try {
        await AuthAPI.me();
      } catch {
        disconnect();
        return;
      }

      // 3. Inizializzazione Socket
      disconnect(); // Pulisce eventuali istanze appese

      socketInstance = io(BACKEND_URL, {
        withCredentials: true, // FONDAMENTALE: Invia i cookie HttpOnly
        transports: ["websocket"], // Forza WebSocket per performance
      });

      setSocket(socketInstance);

      // 4. Gestione Eventi
      socketInstance.on("connect", () => {
        console.log("[System] Socket.io Connected Securely ✅");
      });

      socketInstance.on("refresh", () => {
        console.log("[System] Real-time update signal received ⚡");
        setRefreshTrigger((prev) => prev + 1);
      });

      socketInstance.on("connect_error", (err) => {
        console.warn("[System] Socket connection failed:", err.message);
      });
    };

    // Avvio connessione
    connect();

    // Re-connect su login/logout
    const onAuthChange = () => connect();
    window.addEventListener(AUTH_EVENT, onAuthChange);

    return () => {
      window.removeEventListener(AUTH_EVENT, onAuthChange);
      disconnect();
    };
  }, []);

  // Polling dello stato sistema ogni volta che riceviamo un segnale di refresh
  useEffect(() => {
    checkStatus();
  }, [refreshTrigger]);

  const forceRefresh = () => setRefreshTrigger((prev) => prev + 1);

  return (
    <SystemContext.Provider
      value={{
        socket,
        marketPaused,
        factoryPaused,
        refreshTrigger,
        forceRefresh,
      }}
    >
      {children}
    </SystemContext.Provider>
  );
}

export const useSystem = () => useContext(SystemContext);