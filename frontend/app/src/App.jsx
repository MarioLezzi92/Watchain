import { useState } from "react";
import Login from "./pages/login";
import Consumer from "./pages/consumer";

export default function App() {
  const [address, setAddress] = useState(
    localStorage.getItem("address")
  );

  if (!address) {
    return <Login onLogged={setAddress} />;
  }

  return <Consumer address={address} />;
}
