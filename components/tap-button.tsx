"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { lightTap } from "@/lib/haptics";

type TapButtonProps = HTMLMotionProps<"button"> & {
  children?: ReactNode;
};

function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(hover: none) and (pointer: coarse)");
    const update = () => setIsTouch(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isTouch;
}

export function TapButton({
  children,
  className,
  transition,
  whileTap,
  onTapStart,
  ...props
}: TapButtonProps) {
  const isTouch = useIsTouchDevice();

  return (
    <motion.button
      type="button"
      className={className}
      whileTap={isTouch ? (whileTap ?? { scale: 0.96 }) : whileTap}
      transition={
        transition ?? {
          type: "spring",
          stiffness: 520,
          damping: 32,
          mass: 0.6,
        }
      }
      onTapStart={(event, info) => {
        void lightTap();
        onTapStart?.(event, info);
      }}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export default TapButton;
