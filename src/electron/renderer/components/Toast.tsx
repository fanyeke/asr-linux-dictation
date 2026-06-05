import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, XCircle, Info } from "lucide-react";

interface ToastItem {
  id: number;
  message: string;
  variant: "success" | "error" | "info";
}

interface ToastProps {
  message: string | null;
  variant?: "success" | "error" | "info";
  duration?: number;
}

const variantIcons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
} as const;

const variantIconColors = {
  success: "text-green-400",
  error: "text-red-400",
  info: "text-blue-400",
} as const;

let toastIdCounter = 0;

export function Toast({
  message,
  variant = "info",
  duration = 3000,
}: ToastProps): JSX.Element {
  const toastItem = useMemo<ToastItem | null>(() => {
    if (!message) return null;
    return { id: ++toastIdCounter, message, variant };
  }, [message, variant]);

  const Icon = toastItem ? variantIcons[toastItem.variant] : Info;
  const iconColor = toastItem
    ? variantIconColors[toastItem.variant]
    : "text-blue-400";

  return (
    <div className="fixed bottom-6 right-6 z-[1000] flex flex-col-reverse gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toastItem && (
          <motion.div
            key={toastItem.id}
            data-testid="toast"
            layout
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" as const }}
            className="bg-dark-800 text-white px-5 py-3 rounded-lg shadow-toast flex items-center gap-2.5 pointer-events-auto max-w-sm"
          >
            <Icon size={18} className={`shrink-0 ${iconColor}`} />
            <span className="text-sm font-medium">{toastItem.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Toast;
