import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./app/ProtectedRoute";

// Pagine
import Login from "./pages/login";
import MarketPage from "./pages/MarketPage"; 
import MePage from "./pages/MePage";         

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login è pubblico */}
        <Route path="/login" element={<Login />} />

        {/* Reindirizza la root (/) alla home pubblica (/market) */}
        <Route path="/" element={<Navigate to="/market" replace />} />

        {/* --- MODIFICA: Il Market ora è PUBBLICO (rimosso ProtectedRoute) --- */}
        <Route 
          path="/market" 
          element={<MarketPage />} 
        />

        {/* --- MODIFICA: Solo la MePage rimane PROTETTA --- */}
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