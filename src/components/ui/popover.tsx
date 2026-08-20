// src/components/ui/popover.tsx
// Popover headless (Cult UI, adaptado) — retemado com os tokens do projeto e
// com o trigger fazendo toggle de verdade (o original só abre, nunca fecha
// ao clicar de novo). Fora do escopo: PopoverForm/Label/Textarea/Footer
// (a Task 1 do plano de componentes animados não usa formulário no popover).
"use client"

import React, {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"
import { AnimatePresence, motion, MotionConfig } from "motion/react"

import { cn } from "../../utils"
import { SPRING_MICRO } from "./motion"

function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void
) {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [ref, handler])
}

interface PopoverContextType {
  isOpen: boolean
  openPopover: () => void
  closePopover: () => void
  uniqueId: string
}

const PopoverContext = createContext<PopoverContextType | undefined>(undefined)

function usePopover() {
  const context = useContext(PopoverContext)
  if (!context) throw new Error("usePopover must be used within a PopoverRoot")
  return context
}

interface PopoverRootProps {
  children: React.ReactNode
  className?: string
}

export function PopoverRoot({ children, className }: PopoverRootProps) {
  const uniqueId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const openPopover = () => setIsOpen(true)
  const closePopover = () => setIsOpen(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useClickOutside(rootRef, closePopover)

  return (
    <PopoverContext.Provider value={{ isOpen, openPopover, closePopover, uniqueId }}>
      <MotionConfig transition={SPRING_MICRO}>
        <div ref={rootRef} className={cn("relative flex items-center", className)}>{children}</div>
      </MotionConfig>
    </PopoverContext.Provider>
  )
}

interface PopoverTriggerProps {
  children: React.ReactNode
  className?: string
}

export function PopoverTrigger({ children, className }: PopoverTriggerProps) {
  const { isOpen, openPopover, closePopover, uniqueId } = usePopover()

  return (
    <motion.button
      type="button"
      layoutId={`popover-${uniqueId}`}
      aria-expanded={isOpen}
      className={cn(
        "flex h-10 items-center gap-1.5 rounded-control border px-3 text-[11px] font-semibold uppercase tracking-wider transition-colors",
        isOpen
          ? "border-accent/50 ring-2 ring-accent/20 text-text-primary"
          : "border-border-default bg-surface-inset text-text-muted hover:text-text-secondary",
        className
      )}
      onClick={() => (isOpen ? closePopover() : openPopover())}
    >
      <motion.span layoutId={`popover-label-${uniqueId}`} className="flex items-center gap-1.5">
        {children}
      </motion.span>
    </motion.button>
  )
}

interface PopoverContentProps {
  children: React.ReactNode
  className?: string
}

export function PopoverContent({ children, className }: PopoverContentProps) {
  const { isOpen, closePopover, uniqueId } = usePopover()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePopover()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [closePopover])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          layoutId={`popover-${uniqueId}`}
          // Sem `overflow-y-auto`/`max-h` aqui de propósito: qualquer overflow
          // diferente de `visible` transforma este box num container de corte
          // também no eixo X, e o menu do TreeDropdown (absolute, w-80) é mais
          // largo que o conteúdo interno do popover — ficaria cortado, com
          // scroll dentro do painel em vez de flutuar por cima. O TreeDropdown
          // já rola sozinho (max-h-72). Quem precisar de teto de altura passa
          // pelo `className`.
          className={cn(
            "absolute right-0 top-full z-[150] mt-2 w-80 max-w-[90vw] rounded-card border border-border-default bg-surface-card p-3 shadow-2xl outline-none",
            className
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function PopoverHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-1 pb-2 text-[10.5px] font-semibold uppercase tracking-wider text-text-faint", className)}>
      {children}
    </div>
  )
}
