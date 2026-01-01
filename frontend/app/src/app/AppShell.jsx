import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  UserCircleIcon, 
  ArrowRightOnRectangleIcon, // Icona Logout
  ArrowLeftOnRectangleIcon,  // Icona Login
  ShoppingBagIcon, 
  WalletIcon 
} from "@heroicons/react/24/outline";

function shortAddr(a) {
  const s = String(a || "");
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

export default function AppShell({ title = "WatchDApp", address, balanceLux, children }) {
  const navigate = useNavigate();
  const location = useLocation();

  // --- LOGICA LOGOUT ---
  const handleLogout = () => {
    localStorage.clear();
    // Reindirizza alla root. App.jsx ti porterà poi su /market come utente anonimo
    window.location.href = "/"; 
  };
  // ---------------------

  const isMarket = location.pathname === "/market";

  return (
    <div className="min-h-screen w-full bg-[#f2e9d0] text-zinc-900 font-sans flex flex-col">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 w-full shadow-lg bg-[#4A0404] text-[#f2e9d0] border-b border-[#D4AF37]/30">
        <div className="w-full max-w-7xl mx-auto px-6 h-20 flex items-center justify-between relative">
          
          {/* SINISTRA */}
          <div className="flex-1 flex justify-start">
            {!isMarket && (
              <button
                onClick={() => navigate("/market")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 border bg-white/5 text-[#f2e9d0] border-white/10 hover:bg-[#D4AF37] hover:text-[#4A0404]"
                title="Vai al Mercato"
              >
                <ShoppingBagIcon className="h-5 w-5" />
                <span className="hidden md:inline text-sm uppercase tracking-wide">Market</span>
              </button>
            )}
          </div>

          {/* CENTRO */}
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <button
              onClick={() => navigate("/market")} 
              className="font-serif font-extrabold text-3xl tracking-widest text-[#f2e9d0] hover:text-[#D4AF37] transition-colors duration-300"
              title="Torna alla Home"
            >
              {title}
            </button>
          </div>

          {/* DESTRA */}
          <div className="flex-1 flex justify-end items-center gap-3 md:gap-5">
             
             {address ? (
               // MENU UTENTE LOGGATO
               <>
                 <div className="hidden md:flex flex-col items-end text-xs leading-tight opacity-90">
                    <div className="flex items-center gap-1.5 text-[#D4AF37] font-bold">
                      <WalletIcon className="h-3.5 w-3.5"/>
                      <span>{balanceLux || "0"} LUX</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[#f2e9d0]/70 mt-0.5">
                      <span className="bg-black/20 px-1 rounded">{shortAddr(address)}</span>
                    </div>
                 </div>

                 <div className="hidden md:block h-8 w-px bg-white/20"></div>

                 <button
                  onClick={() => navigate("/me")}
                  className={`p-2.5 rounded-full transition-all duration-300 border shadow-inner ${
                    location.pathname === "/me"
                      ? "bg-[#D4AF37] text-[#4A0404] border-[#D4AF37]"
                      : "bg-white/10 text-[#f2e9d0] border-white/10 hover:bg-[#D4AF37] hover:text-[#4A0404]"
                  }`}
                  title="Area Personale"
                >
                  <UserCircleIcon className="h-6 w-6" />
                </button>

                 <button
                   onClick={handleLogout}
                   className="p-2.5 rounded-full bg-red-900/30 text-red-200 hover:bg-red-600 hover:text-white transition-all duration-300 border border-transparent hover:border-white/20 shadow-inner"
                   title="Disconnetti"
                 >
                   <ArrowRightOnRectangleIcon className="h-6 w-6" />
                 </button>
               </>
             ) : (
               // MENU VISITATORE (Bottone Login)
               <button
                 onClick={() => navigate("/login")}
                 className="flex items-center gap-2 px-5 py-2.5 bg-[#D4AF37] hover:bg-[#c49f27] text-[#4A0404] font-bold rounded-xl shadow-md hover:shadow-lg hover:scale-105 transition-all duration-300"
               >
                 <span>Login</span>
                 <ArrowLeftOnRectangleIcon className="h-5 w-5" />
               </button>
             )}

          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-12 flex-grow">
        {children}
      </main>

      {/* FOOTER */}
      <footer className="bg-[#4A0404] text-[#f2e9d0] border-t border-[#D4AF37]/30 mt-auto">
        <div className="w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <h3 className="font-serif font-bold text-2xl mb-4 tracking-wide text-[#D4AF37]">
                {title}
              </h3>
              <p className="text-[#f2e9d0]/70 text-sm leading-relaxed max-w-xs">
                The premier marketplace for certified luxury timepieces. 
                Authenticated on blockchain, guaranteed by producers.
              </p>
            </div>
            <div>
              <h4 className="font-bold uppercase text-xs tracking-widest text-[#D4AF37]/80 mb-4">
                Marketplace
              </h4>
              <ul className="space-y-2 text-sm text-[#f2e9d0]/80">
                <li><button onClick={() => navigate("/market")} className="hover:text-[#D4AF37] transition-colors">Browse Watches</button></li>
                <li><button onClick={() => address ? navigate("/me") : navigate("/login")} className="hover:text-[#D4AF37] transition-colors">My Collection</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold uppercase text-xs tracking-widest text-[#D4AF37]/80 mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-[#f2e9d0]/80">
                <li><span className="opacity-50">Terms of Service</span></li>
                <li><span className="opacity-50">Contact Us</span></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-[#D4AF37]/20 flex flex-col md:flex-row justify-between items-center text-xs text-[#f2e9d0]/40">
            <p>&copy; {new Date().getFullYear()} {title}.</p>
            <p className="mt-2 md:mt-0 font-mono text-[#D4AF37]/60">Powered by Ethereum Blockchain</p>
          </div>
        </div>
      </footer>
    </div>
  );
}