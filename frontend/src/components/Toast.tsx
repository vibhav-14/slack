import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface Toast {
  id: number;
  message: string;
  error?: boolean;
}

const Ctx = createContext<(message: string, opts?: { error?: boolean }) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const push = useCallback((message: string, opts?: { error?: boolean }) => {
    const id = next.current++;
    setToasts((t) => [...t.slice(-2), { id, message, error: opts?.error }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts?.error ? 6000 : 3500);
  }, []);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.error ? " is-error" : ""}`}>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
