import React from "react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";

export default function SuccessModal({ isOpen, onClose, message }) {
  if (!isOpen) return null;

  return (
    // Overlay scuro
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      
      {/* CARD SUCCESS (Verde Luxury) */}
      <div className="rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100 border border-[#D4AF37] ring-4 ring-[#1A472A]/30">
        
        {/* 1. HEADER: Verde Scuro */}
        <div className="bg-[#1A472A] px-6 py-4 border-b border-[#D4AF37]/50 flex items-center justify-center relative z-10 shadow-md">
          <div className="flex items-center gap-2 text-[#D4AF37]">
            <CheckCircleIcon className="h-6 w-6" />
            <h3 className="font-serif font-bold text-xl tracking-wide">
              Operazione Completata
            </h3>
          </div>
        </div>

        {/* 2. CORPO: Beige Specifico (#f2e9d0) */}
        <div className="p-8 text-center bg-[#f2e9d0]">
          <p className="text-[#1A472A] text-lg font-medium leading-relaxed font-serif">
            {message}
          </p>
        </div>

        {/* 3. FOOTER: Verde Scuro */}
        <div className="px-6 py-4 bg-[#1A472A] flex justify-center border-t border-[#D4AF37]/50 relative z-10">
          <button
            onClick={onClose}
            className="px-8 py-2 bg-[#D4AF37] text-[#1A472A] font-bold rounded-xl shadow-[0_0_15px_rgba(212,175,55,0.4)] hover:bg-[#c49f27] hover:scale-105 transition transform uppercase text-xs tracking-wider"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}