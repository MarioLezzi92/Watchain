import React, { useState, useEffect } from "react";
import { XMarkIcon, CheckBadgeIcon } from "@heroicons/react/24/outline";

export default function WatchDetailsModal({ open, onClose, item, role, onList, onCancel, onBuy, onCertify, busy }) {
  const [inputPrice, setInputPrice] = useState("");

  useEffect(() => {
    if (open) setInputPrice("");
  }, [open, item]);

  if (!open || !item) return null;

  const isListed = item.priceLux !== null;
  const myAddress = (localStorage.getItem("address") || "").toLowerCase();
  const itemSeller = (item.seller || "").toLowerCase();
  const itemOwner = (item.owner || "").toLowerCase();

  const effectiveOwner = (isListed && itemSeller && itemSeller !== "0x0000000000000000000000000000000000000000") 
    ? itemSeller 
    : itemOwner;

  const isMine = effectiveOwner === myAddress;
  const canManage = isMine;
  const canCertify = role === 'reseller' && isMine && !item.certified && !isListed;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      <div className="relative w-full max-w-4xl bg-[#4A0404] text-[#FDFBF7] rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row ring-1 ring-white/10 animate-in fade-in zoom-in duration-300">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white/70 hover:text-white transition"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>

        <div className="md:w-1/2 bg-[#FDFBF7] flex items-center justify-center p-8 relative">
           <div className="absolute top-6 left-6 z-10">
              {item.certified 
                ? <span className="px-3 py-1 bg-[#D4AF37] text-[#4A0404] text-xs font-bold uppercase tracking-widest rounded-md shadow-lg">Certified</span>
                : <span className="px-3 py-1 bg-zinc-600 text-white text-xs font-bold uppercase tracking-widest rounded-md shadow-lg">Uncertified</span>
              }
           </div>
           <img 
             src={item.certified ? "/watch-certified.jpg" : "/watch-uncertified.jpg"} 
             alt="Watch" 
             className="w-full max-w-[320px] object-contain drop-shadow-2xl hover:scale-105 transition duration-700"
           />
        </div>

        <div className="md:w-1/2 p-8 flex flex-col justify-between relative">
          <div className="space-y-6">
            <div>
              <h2 className="text-4xl font-serif font-bold tracking-wide">Watch #{item.tokenId}</h2>
              <p className="text-white/40 font-mono text-xs mt-2 uppercase tracking-wider">
                {isListed ? "Listed on Market" : "Vault Item"}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-black/20 border border-white/5">
              <div className="text-xs text-[#D4AF37] uppercase font-bold tracking-widest mb-1">Current Price</div>
              <div className="text-3xl font-bold text-white">
                {isListed ? `${item.priceLux} LUX` : "Not for sale"}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Owner Address</div>
              <div className="font-mono text-xs text-white/70 break-all bg-black/20 p-2 rounded-lg border border-white/5">
                {effectiveOwner || "0x..."} {isMine && <span className="text-[#D4AF37] ml-2">(You)</span>}
              </div>
            </div>
          </div>

          {/* AZIONI */}
          <div className="mt-8 pt-6 border-t border-white/10 space-y-4">

            {canManage && (
              <div className="space-y-4">
                
                {canCertify && (
                   <button
                     onClick={() => onCertify && onCertify(item)}
                     disabled={busy}
                     className="w-full py-4 bg-[#1A472A] border border-[#D4AF37]/50 text-[#D4AF37] text-lg font-bold rounded-xl hover:bg-[#143d23] hover:scale-[1.02] transition flex items-center justify-center gap-2 mb-4 shadow-lg"
                   >
                     {busy ? "Processing..." : <><CheckBadgeIcon className="h-6 w-6"/> Certifica Orologio</>}
                   </button>
                )}

                {(!isListed && (role === 'producer' || (role === 'reseller' && item.certified))) && (
                  <div className="bg-[#f2e9d0] p-4 rounded-xl shadow-inner border border-[#D4AF37]/30">
                    <label className="block text-[#4A0404] text-xs font-bold uppercase tracking-widest mb-2">
                      Imposta Prezzo (LUX)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Ex: 100"
                        value={inputPrice}
                        onChange={(e) => setInputPrice(e.target.value)}
                        className="w-full bg-white text-[#4A0404] font-bold p-3 rounded-xl border border-[#D4AF37]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                      />
                      <button
                        onClick={() => onList && onList(item, inputPrice)}
                        disabled={!inputPrice || busy}
                        className="whitespace-nowrap px-6 bg-[#D4AF37] hover:bg-[#c49f27] text-[#4A0404] font-bold rounded-xl shadow-md transition disabled:opacity-50 uppercase text-xs tracking-wider"
                      >
                        {busy ? "..." : "List"}
                      </button>
                    </div>
                  </div>
                )}
                
                {(!isListed && role === 'reseller' && !item.certified) && (
                   <div className="text-center text-[#D4AF37] text-xs italic bg-black/20 p-2 rounded-lg">
                     ⚠️ Devi certificare l'orologio prima di poterlo vendere.
                   </div>
                )}

                {isListed && (
                  <div>
                    <div className="text-center mb-2 text-white/50 text-xs italic">
                      Per modificare il prezzo, ritira l'orologio e rimettilo in vendita.
                    </div>
                    <button
                      onClick={() => onCancel && onCancel(item)}
                      disabled={busy}
                      className="w-full py-3 border border-red-500/30 text-red-300 font-bold rounded-xl hover:bg-red-500/10 transition uppercase text-xs tracking-widest"
                    >
                      {busy ? "Processing..." : "Cancel Listing"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {!canManage && isListed && (
              <button
                onClick={() => onBuy && onBuy(item)}
                disabled={busy}
                className="w-full py-4 bg-[#D4AF37] hover:bg-[#c49f27] text-[#4A0404] text-lg font-bold rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.3)] transition transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
              >
                {busy ? "Processing..." : `Buy Now for ${item.priceLux} LUX`}
              </button>
            )}

            <div className="flex justify-end md:hidden">
                <button onClick={onClose} className="text-white/50 text-sm hover:text-white">Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}