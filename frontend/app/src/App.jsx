import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./app/ProtectedRoute";

// Pagine rimaste (quelle vere!)
import Login from "./pages/Login";
import MarketPage from "./pages/MarketPage"; // La nostra Home
import MePage from "./pages/MePage";         // La Dashboard unica

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login è pubblico */}
        <Route path="/login" element={<Login />} />

        {/* Rotte Protette (richiedono Login) */}
        
        {/* La Home ("/") reindirizza subito al Market */}
        <Route path="/" element={<Navigate to="/market" replace />} />

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

        {/* Qualsiasi altra rotta sconosciuta -> Torna al Market */}
        <Route path="*" element={<Navigate to="/market" replace />} />
        
      </Routes>
    </BrowserRouter>
  );
}