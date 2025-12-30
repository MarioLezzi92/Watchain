export default function Button({ children, className = "", variant = "solid", ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    solid: "bg-white text-black hover:bg-zinc-200",
    outline: "border border-zinc-700 text-white hover:bg-zinc-800",
    danger: "bg-rose-600 text-white hover:bg-rose-500",
  };
  return (
    <button className={`${base} ${variants[variant] || variants.solid} ${className}`} {...props}>
      {children}
    </button>
  );
}
