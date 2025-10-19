// components/ui/Toast.tsx
import { useEffect } from "react";
import { motion } from "framer-motion";

import { IoShieldCheckmarkOutline } from "react-icons/io5";
interface ToastProps {
  type?: "success" | "error" | "warning" | "info";
  message: string;
  onClose: () => void;
  duration?: number;
}

const toastColors = {
  success: "bg-blue-600 text-white ",
  error: "bg-red-100 text-red-700 border-red-400",
  warning: "bg-yellow-100 text-yellow-700 border-yellow-400",
  info: "bg-blue-100 text-blue-700 border-blue-400",
};

export default function Toast({
  type = "success",
  message,
  onClose,
  duration = 3000,
}: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 150 }}
      exit={{ opacity: 0, y: -20 }}
      className={`flex items-center gap-[15px] px-[25px] py-[20px]  rounded-2xl  bg-[#EEFFF6] ${toastColors[type]}`}
    >
        <div className="rounded-full     flex items-center justify-center">
<IoShieldCheckmarkOutline className=' text-4xl text-white' />
</div>

        <div>

      <span className=" capitalize text-white font-bold text-[20px]">{type}</span>
      <p className="font-nunito text-white text-[14px]">{message}</p>
        </div>
    </motion.div>
  );
}
