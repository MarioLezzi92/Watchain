import { metamaskLogin } from "../lib/auth";

export default function Login({ onLogged }) {
  return (
    <div style={{ padding: 24 }}>
      <h2>Login</h2>
      <button
        onClick={async () => {
          const { address } = await metamaskLogin("consumer");
          onLogged(address);
        }}
      >
        Login con MetaMask
      </button>
    </div>
  );
}
