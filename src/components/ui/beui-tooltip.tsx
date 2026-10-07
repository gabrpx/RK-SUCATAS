"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

type Side = "top" | "right" | "bottom" | "left";

export interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  side?: Side;
  delay?: number;
  className?: string;
  wrapperClassName?: string;
}

const transformOrigin: Record<Side, string> = {
  top: "center bottom",
  bottom: "center top",
  left: "right center",
  right: "left center",
};

const offsetFrom: Record<Side, { x?: number; y?: number }> = {
  top: { y: 10 },
  bottom: { y: -10 },
  left: { x: 10 },
  right: { x: -10 },
};

function buildVariants(side: Side): Variants {
  const offset = offsetFrom[side];

  return {
    initial: {
      opacity: 0,
      scale: 0.85,
      filter: "blur(10px)",
      x: offset.x ?? 0,
      y: offset.y ?? 0,
    },
    animate: {
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      x: 0,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 380,
        damping: 30,
        mass: 0.7,
        opacity: { duration: 0.22, ease: EASE_OUT },
        filter: { duration: 0.3, ease: EASE_OUT },
      },
    },
    exit: {
      opacity: 0,
      scale: 0.92,
      filter: "blur(6px)",
      x: (offset.x ?? 0) * 0.6,
      y: (offset.y ?? 0) * 0.6,
      transition: { duration: 0.14, ease: EASE_OUT },
    },
  };
}

const REDUCED_VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.14, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.1, ease: EASE_OUT },
  },
};

export function useHoverCapable() {
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setCanHover(mq.matches);

    update();
    mq.addEventListener?.("change", update);

    return () => mq.removeEventListener?.("change", update);
  }, []);

  return canHover;
}

const GAP = 8;

function getFixedPosition(rect: DOMRect, side: Side): { top: number; left: number } {
  switch (side) {
    case "top":
      return { top: rect.top - GAP, left: rect.left + rect.width / 2 };
    case "bottom":
      return { top: rect.bottom + GAP, left: rect.left + rect.width / 2 };
    case "left":
      return { top: rect.top + rect.height / 2, left: rect.left - GAP };
    case "right":
      return { top: rect.top + rect.height / 2, left: rect.right + GAP };
  }
}

function getTransform(side: Side): string {
  switch (side) {
    case "top":
      return "translateX(-50%) translateY(-100%)";
    case "bottom":
      return "translateX(-50%)";
    case "left":
      return "translateX(-100%) translateY(-50%)";
    case "right":
      return "translateY(-50%)";
  }
}

const WARM_WINDOW_MS = 300;
let lastHiddenAt = 0;

export function Tooltip({
  content,
  children,
  side = "top",
  delay = 120,
  className,
  wrapperClassName,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const id = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const reduce = useReducedMotion();
  const canHover = useHoverCapable();

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos(getFixedPosition(rect, side));
  }, [side]);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  const show = () => {
    if (!canHover) return;

    if (timer.current) clearTimeout(timer.current);

    const warm = Date.now() - lastHiddenAt < WARM_WINDOW_MS;

    timer.current = setTimeout(() => {
      setOpen(true);
    }, warm ? 0 : delay);
  };

  const hide = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    if (open) lastHiddenAt = Date.now();

    setOpen(false);
  };

  if (!isValidElement(children)) return children;

  const trigger = cloneElement(children as ReactElement<Record<string, unknown>>, {
    ref: (node: HTMLElement | null) => { triggerRef.current = node; },
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
    "aria-describedby": id,
  });

  const variants = reduce ? REDUCED_VARIANTS : buildVariants(side);

  const tooltipEl = (
    <AnimatePresence mode="wait">
      {open && pos ? (
        <span
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            transform: getTransform(side),
            transformOrigin: transformOrigin[side],
            zIndex: 9999,
            pointerEvents: "none",
          }}
        >
          <motion.span
            id={id}
            role="tooltip"
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ willChange: "transform, opacity, filter" }}
            className={cn(
              "block whitespace-nowrap rounded-lg border border-border-default bg-surface-overlay/85 px-2.5 py-1 text-xs font-medium text-text-primary shadow-2xl backdrop-blur-xl",
              className,
            )}
          >
            {content}
          </motion.span>
        </span>
      ) : null}
    </AnimatePresence>
  );

  return (
    <span className={cn("relative inline-flex", wrapperClassName)}>
      {trigger}
      {typeof document !== "undefined" ? createPortal(tooltipEl, document.body) : null}
    </span>
  );
}
