import { metamaskLogin } from "../lib/auth";

export default function Login({ onLogged }) {
  return (
    <div style={{ padding: 32, color: "#fff" }}>
      <h1 style={{ fontSize: 48, margin: 0 }}>WatchDApp</h1>
      <p style={{ opacity: 0.85, marginTop: 10 }}>
        Login con MetaMask. Il backend assegna il ruolo (producer/reseller/consumer) in base alla whitelist.
      </p>

      <button
        onClick={async () => {
          const { address } = await metamaskLogin();
          if (typeof onLogged === "function") onLogged(address);
        }}
        style={{
          marginTop: 16,
          background: "#111",
          border: "1px solid #fff",
          color: "white",
          padding: "12px 18px",
          borderRadius: 10,
          cursor: "pointer",
        }}
      >
        Login con MetaMask
      </button>
    </div>
  );
}
