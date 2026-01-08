import React, { useState, useEffect } from "react";
import { XCircleIcon } from "@heroicons/react/24/outline";
import { setReseller } from "../../services/marketService"; // Assicurati del percorso

export default function ResellerModal({ isOpen, onClose, onDone }) {
  const [resellersOptions, setResellersOptions] = useState([]);
  const [who, setWho] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // Carica lista al mount (o all'apertura)
  useEffect(() => {
    if(!isOpen) return;
    try {
      const rawEnv = import.meta.env.VITE_RESELLERS;
      if (rawEnv) {
        const parsed = JSON.parse(rawEnv);
        if (Array.isArray(parsed)) setResellersOptions(parsed);
      }
    } catch (e) { console.warn(e); }
    
    const singleAddr = (import.meta.env.VITE_RESELLER_ADDRESS || "").trim();
    if (singleAddr) {
      setResellersOptions(prev => [...prev, { name: "Reseller Default", address: singleAddr }]);
    }
  }, [isOpen]);

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!who) return setMsg("❌ Seleziona un address.");

    try {
      setBusy(true);
      await setReseller(who, enabled);
      setMsg(`✅ Operazione completata.`);
      if (onDone) onDone();
      // setTimeout(onClose, 1500); // Opzionale: chiudi dopo successo
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#4A0404] text-[#FDFBF7] rounded-3xl p-8 shadow-2xl w-full max-w-lg border border-[#5e0a0a] relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white">
            <XCircleIcon className="h-6 w-6" />
        </button>

        <h2 className="text-2xl font-serif font-bold mb-1">Gestione Reseller</h2>
        <p className="text-red-100/60 text-sm mb-6">Abilita o disabilita partner commerciali.</p>

        <form onSubmit={submit} className="space-y-4">
            <div>
                <label className="text-xs uppercase font-bold text-[#D4AF37] tracking-wider mb-2 block">Reseller</label>
                <select
                    value={who}
                    onChange={(e) => setWho(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-zinc-100 text-sm outline-none focus:border-[#D4AF37]/50"
                >
                    <option value="" className="text-gray-500 bg-white">-- Seleziona --</option>
                    {resellersOptions.map((r, i) => (
                    <option key={i} value={r.address} className="text-black bg-white">{r.name}</option>
                    ))}
                </select>
            </div>

            <div>
                <label className="text-xs uppercase font-bold text-[#D4AF37] tracking-wider mb-2 block">Azione</label>
                <div className="flex gap-4">
                    <label className={`flex-1 cursor-pointer border rounded-xl p-3 text-center transition ${enabled ? 'bg-white/10 border-[#D4AF37] text-[#D4AF37]' : 'border-white/10 opacity-50'}`}>
                        <input type="radio" checked={enabled} onChange={() => setEnabled(true)} className="hidden"/>
                        Abilita
                    </label>
                    <label className={`flex-1 cursor-pointer border rounded-xl p-3 text-center transition ${!enabled ? 'bg-white/10 border-red-400 text-red-400' : 'border-white/10 opacity-50'}`}>
                        <input type="radio" checked={!enabled} onChange={() => setEnabled(false)} className="hidden"/>
                        Disabilita
                    </label>
                </div>
            </div>

            <button
                type="submit"
                disabled={busy}
                className="w-full py-4 bg-[#D4AF37] hover:bg-[#c49f27] text-[#4A0404] font-bold rounded-xl shadow-lg mt-4 disabled:opacity-50"
            >
                {busy ? "Working..." : "Conferma Aggiornamento"}
            </button>
        </form>

        {msg && <div className="mt-4 p-3 bg-black/20 rounded-lg text-sm text-center font-mono">{msg}</div>}
      </div>
    </div>
  );
}