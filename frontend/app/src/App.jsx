import { useMemo, useState } from "react";
import Login from "./pages/login";
import Consumer from "./pages/consumer";
import Producer from "./pages/producer";
import Reseller from "./pages/reseller";

function getStored(key) {
  const v = localStorage.getItem(key);
  return v ? String(v) : "";
}

export default function App() {
  const [address, setAddress] = useState(getStored("address"));

  const role = useMemo(() => getStored("role").trim().toLowerCase(), [address]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("address");
    localStorage.removeItem("role");
    setAddress("");
  };

  if (!address) {
    return <Login onLogged={setAddress} />;
  }

  if (role === "producer") {
    return <Producer address={address} onLogout={handleLogout} />;
  }

  if (role === "reseller") {
    return <Reseller address={address} onLogout={handleLogout} />;
  }

  return <Consumer address={address} onLogout={handleLogout} />;
}
