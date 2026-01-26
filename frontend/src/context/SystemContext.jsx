import React, { createContext, useContext, useState, useEffect } from "react";
import { io } from "socket.io-client";
import { FF_BASE, FF, AuthAPI } from "../lib/api.js";
import { AUTH_EVENT, isLoggedIn } from "../lib/auth.js";

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

      setMarketPaused(m?.output === true || m?.output === "true");
      setFactoryPaused(f?.output === true || f?.output === "true");
    } catch (error) {
      console.warn("System status check failed:", error);
    }
  };

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
      // se non sei loggato lato client, niente /auth/me e niente socket
      if (!isLoggedIn()) {
        disconnect();
        return;
      }

      // valida cookie (se access scaduto, api.js prova refresh; se fallisce -> 401)
      try {
        await AuthAPI.me();
      } catch {
        disconnect();
        return;
      }

      // evita socket duplicati
      disconnect();

      socketInstance = io(BACKEND_URL, {
        withCredentials: true,
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

    const onAuthChange = () => {
      connect();
    };

    window.addEventListener(AUTH_EVENT, onAuthChange);

    return () => {
      window.removeEventListener(AUTH_EVENT, onAuthChange);
      disconnect();
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
