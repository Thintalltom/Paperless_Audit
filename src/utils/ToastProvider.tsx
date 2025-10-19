// components/ui/ToastProvider.tsx
import { createContext, useContext, useState, ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import Toast from "./Toast";

interface ToastData {
  id: number;
  type?: "success" | "error" | "warning" | "info";
  message: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (toast: Omit<ToastData, "id">) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = (toast: Omit<ToastData, "id">) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { ...toast, id }]);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-5 right-5 flex flex-col gap-2 z-50">
        <AnimatePresence>
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              type={toast.type}
              message={toast.message}
              duration={toast.duration}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
};
