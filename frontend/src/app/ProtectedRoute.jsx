import React from "react";
import { Navigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

/**
 *  Protezione delle rotte.
 * Gestisce:
 * 1. Loading State: Previene redirect errati durante l'idratazione della sessione.
 * 2. Authentication Check: Verifica presenza address/role.
 * 3. Authorization Check (RBAC): Verifica se il ruolo ha i permessi necessari.
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { role, address, loading } = useWallet();

  // 1. Loading State (UX Optimization)
  // Evita l'effetto "flash" del login redirect mentre stiamo ancora leggendo il cookie/storage.
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FDFBF7]">
        <div className="text-[#4A0404] font-serif animate-pulse text-xl">
          Verifica identità in corso...
        </div>
      </div>
    );
  }

  // 2. Authentication Check
  if (!role || !address) {
    return <Navigate to="/login" replace />;
  }

  // 3. Authorization Check (RBAC)
  // Se la rotta richiede ruoli specifici (es. solo Producer) e l'utente non lo ha.
  if (allowedRoles && !allowedRoles.includes(role)) {
    // Potremmo redirectare a una pagina "403 Forbidden", ma il login è un fallback sicuro.
    return <Navigate to="/login" replace />;
  }

  // Access Granted
  return children;
}