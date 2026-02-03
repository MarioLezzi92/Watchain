import React from "react";
import { shortAddr } from "../../lib/formatters";

const CERT_IMG = "/watch-certified.jpg";
const UNCERT_IMG = "/watch-uncertified.jpg";

/**
 * Componente Presentational per le card degli orologi.
 * Gestisce visualizzazione condizionale (Market vs Inventory) e badge di stato.
 */
export default function WatchCard({ item, onOpen, variant = "market" }) {
  // Normalizzazione dati
  const tokenId = String(item?.tokenId ?? "");
  const certified = Boolean(item?.certified);
  
  const seller = item?.seller ? String(item.seller).toLowerCase() : null;
  const owner = item?.owner ? String(item.owner).toLowerCase() : null;

  const isListed = item?.priceLux != null;
  
  // Visualizzazione banner "In Vendita" solo se siamo nel proprio inventario
  const showBanner = isListed && variant === "inventory";
  const imgSrc = certified ? CERT_IMG : UNCERT_IMG;

  return (
    <button
      onClick={() => onOpen?.(item)}
      className="group relative flex flex-col w-full text-left rounded-xl bg-[#4A0404] text-[#FDFBF7] shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
    >
      {/* Container Immagine */}
      <div className="w-full aspect-square bg-zinc-900 relative overflow-hidden">
        <img
          src={imgSrc}
          alt={`Watch #${tokenId}`}
          className={`h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-95 group-hover:opacity-100 ${showBanner ? "grayscale-[0.3]" : ""}`}
          onError={(e) => { e.currentTarget.style.display = "none"; }} // Fallback robusto
        />

        {/* Badge Certificazione */}
        <div className="absolute top-3 left-3">
           {certified
             ? <span className="px-3 py-1 rounded-md bg-[#D4AF37] text-[#4A0404] text-[10px] font-bold uppercase tracking-widest shadow-lg">Certified</span>
             : <span className="px-3 py-1 rounded-md bg-zinc-600 text-white text-[10px] font-bold uppercase tracking-widest shadow-lg">Uncertified</span>
           }
        </div>

        {/* Banner Stato (per Inventory View) */}
        {showBanner && (
          <div className="absolute bottom-0 left-0 w-full bg-[#D4AF37]/90 text-[#4A0404] text-center py-1 font-bold text-xs uppercase tracking-wider backdrop-blur-sm shadow-md">
            In Vendita {item.priceLux && item.priceLux !== "0" ? `(${item.priceLux} LUX)` : ""}
          </div>
        )}
      </div>

      {/* Info Body */}
      <div className="p-5 flex flex-col gap-1 w-full border-t border-white/10">
        <div>
          <h3 className="text-[#FDFBF7] font-serif font-bold text-xl tracking-wide">Watch #{tokenId}</h3>
          
          {/* Metadata Condizionali */}
          <div className="text-xs text-red-100/60 font-mono mt-1">
            {isListed && seller 
              ? <>Seller: {shortAddr(seller)}</> 
              : owner 
                ? <>Owner: {shortAddr(owner)}</> 
                : null
            }
          </div>
        </div>

        {/* Prezzo / Stato */}
        <div className="mt-4 flex items-center justify-end h-6">
           {isListed ? (
             <span className="text-[#D4AF37] font-bold text-xl">
               {item.priceLux} <span className="text-xs text-red-100/50 font-normal">LUX</span>
             </span>
           ) : (
             <span className="text-white/20 text-xs uppercase font-medium tracking-widest">Not Listed</span>
           )}
        </div>
      </div>
    </button>
  );
}