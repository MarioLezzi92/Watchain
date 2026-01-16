import React from "react";
import { Navigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { role, loading } = useWallet();

  // 1. Mentre il context carica i dati dal token, mostriamo un caricamento
  // Evita che l'utente venga sparato al login solo perché il context non è ancora pronto
  if (loading) {
    return <div className="flex h-screen items-center justify-center">Caricamento...</div>;
  }

  // 2. Se non c'è un ruolo, l'utente non è autenticato
  if (!role) {
    return <Navigate to="/login" replace />;
  }

  // 3. Se la rotta richiede ruoli specifici (es. solo producer) e l'utente non lo è
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/market" replace />;
  }

  return children;
}