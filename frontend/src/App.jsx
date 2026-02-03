import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./app/ProtectedRoute";
import Login from "./pages/LoginPage";
import MarketPage from "./pages/MarketPage";
import MePage from "./pages/MePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rotta Pubblica: Login */}
        <Route path="/login" element={<Login />} />
        
        {/* Redirect Root -> Market (UX: Landing page predefinita) */}
        <Route path="/" element={<Navigate to="/market" replace />} />

        {/* ROTTE PROTETTE 
           Queste pagine sono avvolte da 'ProtectedRoute'.
           Se l'utente non ha un cookie JWT valido o non ha connesso il wallet,
           viene reindirizzato forzatamente al Login.
        */}
        
        <Route
          path="/market"
          element={
            <ProtectedRoute>
              <MarketPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/me"
          element={
            <ProtectedRoute>
              <MePage />
            </ProtectedRoute>
          }
        />
        
        {/* Catch-all: Qualsiasi URL sconosciuto porta al Market */}
        <Route path="*" element={<Navigate to="/market" replace />} />
      </Routes>
    </BrowserRouter>
  );
}