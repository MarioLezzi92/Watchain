import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./app/ProtectedRoute";
import Login from "./pages/login";
import MarketPage from "./pages/MarketPage"; 
import MePage from "./pages/MePage";         

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/market" replace />} />

        {/* Market è pubblico o per tutti i loggati */}
        <Route path="/market" element={<MarketPage />} />

        {/* MePage è protetta: devi essere loggato */}
        <Route
          path="/me"
          element={
            <ProtectedRoute>
              <MePage />
            </ProtectedRoute>
          }
        />
        
        <Route path="*" element={<Navigate to="/market" replace />} />
      </Routes>
    </BrowserRouter>
  );
}