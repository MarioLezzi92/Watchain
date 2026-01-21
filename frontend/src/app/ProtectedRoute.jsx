import React from "react";
import { Navigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { role, address, loading } = useWallet();

  // 1. Mentre il context carica i dati dal token, rimaniamo in attesa.
  // Questo evita che un utente loggato venga sbattuto al login per un millisecondo.
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FDFBF7]">
        <div className="text-[#4A0404] font-serif animate-pulse text-xl">
          Verifica identità in corso...
        </div>
      </div>
    );
  }

  // 2. Se non c'è un ruolo O non c'è un indirizzo, l'utente NON è autenticato.
  if (!role || !address) {
    return <Navigate to="/login" replace />;
  }

  // 3. Controllo Permessi: se la rotta è solo per "producer" e tu sei "consumer".
  if (allowedRoles && !allowedRoles.includes(role)) {
    // Se non hai i permessi, ti rimandiamo al mercato invece che al login
    return <Navigate to="/market" replace />;
  }

  // Se tutto è okay, visualizza la pagina richiesta
  return children;
}