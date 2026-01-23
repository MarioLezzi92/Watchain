import React, { createContext, useContext, useState, useEffect } from "react";
import { io } from "socket.io-client";
import { FF_BASE, FF, AuthAPI } from "../lib/api.js";
import { getToken, AUTH_EVENT } from "../lib/auth.js";

const BACKEND_URL = "http://localhost:3001";

const SystemContext = createContext();

export function SystemProvider({ children }) {
  const [marketPaused, setMarketPaused] = useState(false);
  const [factoryPaused, setFactoryPaused] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [socket, setSocket] = useState(null);

  // Verità: chain
  const checkStatus = async () => {
    try {
      const baseUrl = FF_BASE.producer;
      const [m, f] = await Promise.all([
        FF.watchMarket.query.paused(baseUrl),
        FF.watchNft.query.paused(baseUrl),
      ]);

      const isMarketPaused = m?.output === true || m?.output === "true";
      const isFactoryPaused = f?.output === true || f?.output === "true";

      setMarketPaused(isMarketPaused);
      setFactoryPaused(isFactoryPaused);
    } catch (error) {
      console.warn("System status check failed:", error);
    }
  };

  // Socket autenticato via JWT (handshake.auth.token) + validazione token all'avvio
  useEffect(() => {
    let socketInstance = null;

    const connect = async () => {
      const token = getToken();
      if (!token) {
        setSocket(null);
        return;
      }

      // valida subito il token col backend
      // Se è scaduto/invalid, /auth/me risponde 401 e api.js farà clearSession()
      try {
        await AuthAPI.me();
      } catch {
        setSocket(null);
        return; // non connettere socket se token non valido
      }

      socketInstance = io(BACKEND_URL, {
        auth: { token },
        transports: ["websocket"],
      });

      setSocket(socketInstance);

      socketInstance.on("connect", () => {
        console.log("Socket.io connesso ✅");
      });

      socketInstance.on("refresh", () => {
        setRefreshTrigger((prev) => prev + 1);
      });

      socketInstance.on("connect_error", (err) => {
        console.warn("Socket connect_error:", err?.message || err);
      });
    };

    connect();

    const onAuthChange = async () => {
      if (socketInstance) socketInstance.disconnect();
      socketInstance = null;
      await connect();
    };

    window.addEventListener(AUTH_EVENT, onAuthChange);

    return () => {
      window.removeEventListener(AUTH_EVENT, onAuthChange);
      if (socketInstance) socketInstance.disconnect();
    };
  }, []);

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
