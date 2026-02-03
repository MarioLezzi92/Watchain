import React from "react";
import { XCircleIcon } from "@heroicons/react/24/outline";

/**
 * Modale Errore Unificato.
 * Visualizza messaggi di errore "sanificati" (tradotti da formatters.js)
 */
export default function ErrorModal({ isOpen, onClose, message }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      
      <div className="rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100 border border-red-500/50 ring-4 ring-red-900/30">

        <div className="bg-[#7F1D1D] px-6 py-4 border-b border-red-400/30 flex items-center justify-center relative z-10 shadow-md">
          <div className="flex items-center gap-2 text-red-100">
            <XCircleIcon className="h-7 w-7 text-red-200" />
            <h3 className="font-serif font-bold text-xl tracking-wide">
              Errore
            </h3>
          </div>
        </div>
     
        <div className="p-8 text-center bg-[#f2e9d0]">
          <p className="text-[#4A0404] text-lg font-medium leading-relaxed font-serif">
            {message || "Si è verificato un errore imprevisto."}
          </p>
        </div>
      
        <div className="px-6 py-4 bg-[#4A0404] flex justify-center border-t border-red-500/20 relative z-10">
          <button
            onClick={onClose}
            className="px-8 py-2 bg-[#7F1D1D] text-red-50 font-bold rounded-xl shadow-lg hover:bg-red-800 hover:scale-105 transition transform uppercase text-xs tracking-wider border border-red-400/20"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}