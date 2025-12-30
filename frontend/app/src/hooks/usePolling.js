import { useEffect, useRef } from "react";

export default function usePolling(fn, ms, deps = []) {
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    let timer = null;
    let stopped = false;

    const tick = async () => {
      try { await saved.current(); } catch {}
      if (!stopped) timer = setTimeout(tick, ms);
    };

    tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
