import React from "react";

/**
 * Modale di Conferma Generico.
 */
export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, busy }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      
      <div className="rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 border border-[#D4AF37] ring-4 ring-[#4A0404]/30">
        
        {/* Header */}
        <div className="bg-[#4A0404] px-6 py-4 border-b border-[#D4AF37]/50 flex items-center justify-between relative z-10 shadow-md">
          <h3 className="text-[#D4AF37] font-serif font-bold text-xl tracking-wide">
            {title || "Conferma Azione"}
          </h3>
        </div>

        {/* Body */}
        <div className="p-10 text-center bg-[#f2e9d0]">
          <p className="text-[#4A0404] text-lg font-medium leading-relaxed font-serif">
            {message}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-5 bg-[#4A0404] flex gap-4 justify-center border-t border-[#D4AF37]/50 shadow-[0_-5px_15px_rgba(0,0,0,0.2)] relative z-10">
          
          <button
            onClick={onClose}
            disabled={busy}
            className="px-5 py-2.5 bg-transparent border border-[#D4AF37]/50 text-[#D4AF37] font-bold rounded-xl hover:bg-[#D4AF37]/10 transition disabled:opacity-50 uppercase text-xs tracking-wider"
          >
            Annulla
          </button>

          <button
            onClick={onConfirm}
            disabled={busy}
            className="px-8 py-2.5 bg-[#D4AF37] text-[#4A0404] font-bold rounded-xl shadow-[0_0_15px_rgba(212,175,55,0.4)] hover:bg-[#c49f27] hover:scale-105 transition transform disabled:opacity-50 flex items-center gap-2 uppercase text-xs tracking-wider"
          >
            {busy ? (
              // Feedback visivo di caricamento (Spinner)
              <>
                <span className="w-4 h-4 border-2 border-[#4A0404] border-t-transparent rounded-full animate-spin"></span>
                Elaborazione...
              </>
            ) : (
              "Conferma"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}